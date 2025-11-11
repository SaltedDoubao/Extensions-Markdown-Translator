import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import * as crypto from 'crypto';
import { TranslationQueueManager } from './translationQueue';

type ProgressReporter = { report: (p: { message?: string; increment?: number }) => void };
type CancelToken = { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => void };

export class Translator {
  private api: ApiClient;
  private cancelled = false;
  private translating = false;
  private cache = new Map<string, string>(); // 简单内存缓存, 可替换为 persistent storage
  private queueManager: TranslationQueueManager;

  constructor(private context: vscode.ExtensionContext) {
    this.api = new ApiClient(context);
    this.queueManager = new TranslationQueueManager();
  }

  cancel() {
    this.cancelled = true;
    this.api.cancelOngoing();
    this.queueManager.cancel();
  }

  isTranslating(): boolean {
    return this.translating;
  }

  clearCache() {
    this.cache.clear();
  }

  private hash(text: string) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  // 核心：接收 markdown 原文，返回翻译后的 markdown
  async translateMarkdown(
    markdown: string,
    opts: {
      targetLang: string;
      progress?: ProgressReporter;
      token?: CancelToken;
      chunkSize?: number;
      onChunkTranslated?: (args: { index: number; total: number; translated: string }) => Promise<void>;
      useQueue?: boolean; // 新增：是否使用队列模式
    }
  ): Promise<string> {
    this.cancelled = false;
    this.translating = true;

    try {
      const { targetLang, progress, token, chunkSize, onChunkTranslated, useQueue } = opts;

      // 1. 抽取并替换占位（保留 code fences, inline code, tables 等）
      progress?.report({ message: '提取不可翻译块...' });
      const { placeholderText, placeholders } = this.extractPlaceholders(markdown);

      // 2. 分段（智能分段并合并）
      progress?.report({ message: '分段并准备翻译...' });
      const segments = this.segmentText(placeholderText, chunkSize);

      // 3. 获取配置
      const config = vscode.workspace.getConfiguration('mdTranslator');
      const maxRetries = config.get<number>('retryAttempts', 3);

      // 4. 根据配置选择翻译方式
      const translatedSegments: string[] = useQueue
        ? await this.translateWithQueue(segments, targetLang, progress, token, onChunkTranslated, maxRetries)
        : await this.translateSequentially(segments, targetLang, progress, token, onChunkTranslated);

      // 5. 合并译文并恢复占位符
      progress?.report({ message: '合并译文并恢复格式...' });
      const joined = translatedSegments.join('\n\n');
      const restored = this.restorePlaceholders(joined, placeholders);
      return restored;
    } finally {
      this.translating = false;
    }
  }

  // 使用队列模式翻译（推荐）
  private async translateWithQueue(
    segments: string[],
    targetLang: string,
    progress?: ProgressReporter,
    token?: CancelToken,
    onChunkTranslated?: (args: { index: number; total: number; translated: string }) => Promise<void>,
    maxRetries: number = 3
  ): Promise<string[]> {
    // 过滤已缓存的段落
    const tasksWithCache = segments.map((seg, idx) => ({
      index: idx,
      text: seg,
      cacheKey: this.hash(seg + '|' + targetLang),
      cached: this.cache.get(this.hash(seg + '|' + targetLang))
    }));

    const uncachedTasks = tasksWithCache.filter(t => !t.cached);
    const results: string[] = new Array(segments.length);

    // 填充缓存的结果
    tasksWithCache.forEach(t => {
      if (t.cached) {
        results[t.index] = t.cached;
      }
    });

    if (uncachedTasks.length === 0) {
      return results;
    }

    // 处理未缓存的段落
    progress?.report({ message: `队列翻译: 共 ${uncachedTasks.length} 段待翻译...` });

    try {
      const translatedTexts = await this.queueManager.processSegments(
        uncachedTasks.map(t => t.text),
        targetLang,
        (text, lang) => this.api.translate(text, lang),
        {
          maxRetries,
          onProgress: (completed, total) => {
            if (token?.isCancellationRequested || this.cancelled) {
              this.queueManager.cancel();
              throw new Error('用户取消翻译');
            }

            const currentTask = uncachedTasks[completed];
            if (currentTask) {
              progress?.report({
                message: `翻译段落 ${completed + 1}/${total}...`,
                increment: (100 * completed) / total
              });
            }
          }
        }
      );

      // 填充翻译结果并更新缓存
      uncachedTasks.forEach((task, idx) => {
        const translated = translatedTexts[idx];
        results[task.index] = translated;
        this.cache.set(task.cacheKey, translated);

        if (onChunkTranslated) {
          onChunkTranslated({
            index: task.index,
            total: segments.length,
            translated
          });
        }
      });

      return results;
    } catch (error) {
      throw new Error(`队列翻译失败: ${error}`);
    }
  }

  // 传统顺序翻译（兼容旧版）
  private async translateSequentially(
    segments: string[],
    targetLang: string,
    progress?: ProgressReporter,
    token?: CancelToken,
    onChunkTranslated?: (args: { index: number; total: number; translated: string }) => Promise<void>
  ): Promise<string[]> {
    const translatedSegments: string[] = [];
    let done = 0;

    for (const seg of segments) {
      if (token?.isCancellationRequested || this.cancelled) {
        throw new Error('用户取消翻译');
      }

      const key = this.hash(seg + '|' + targetLang);
      if (this.cache.has(key)) {
        translatedSegments.push(this.cache.get(key)!);
      } else {
        progress?.report({ message: `翻译段落 ${done + 1}/${segments.length}...`, increment: (100 * done) / segments.length });
        const t = await this.api.translate(seg, targetLang);
        this.cache.set(key, t);
        if (onChunkTranslated) {
          await onChunkTranslated({ index: done, total: segments.length, translated: t });
        }
        translatedSegments.push(t);
      }
      done++;
    }

    return translatedSegments;
  }

  // 提取占位符（示例：把 ```code```、`inline`、HTML 标签、YAML front matter 等替换为占位符）
  private extractPlaceholders(text: string) {
    const placeholders: { id: string; raw: string }[] = [];
    // 简易：处理 code fences
    const fenceRE = /```[\s\S]*?```/g;
    let idx = 0;
    const placeholderText = text.replace(fenceRE, (m) => {
      const id = `__MDPLACEHOLDER_${idx++}__`;
      placeholders.push({ id, raw: m });
      return id;
    });

    // 可扩展：处理 inline code、html blocks、tables、front-matter 等
    return { placeholderText, placeholders };
  }

  private restorePlaceholders(text: string, placeholders: { id: string; raw: string }[]) {
    let out = text;
    for (const p of placeholders) {
      out = out.replace(new RegExp(p.id, 'g'), p.raw);
    }
    return out;
  }

  private segmentText(text: string, chunkSize?: number): string[] {
    // 智能分段：优先按照 Markdown 结构分段
    const parts = this.smartSegment(text);

    if (!chunkSize || chunkSize <= 0) {
      return parts;
    }

    const merged: string[] = [];
    let current = '';

    const flush = () => {
      if (current.trim()) {
        merged.push(current.trim());
        current = '';
      }
    };

    // 按句子分割超大段落
    const splitLargePart = (part: string, maxSize: number): string[] => {
      if (part.length <= maxSize) return [part];

      const chunks: string[] = [];
      // 按句子分割（支持中英文标点）
      const sentences = part.split(/(?<=[。！？\.!?])\s*/);
      let chunk = '';

      for (const sentence of sentences) {
        if (chunk && (chunk.length + sentence.length > maxSize)) {
          chunks.push(chunk.trim());
          chunk = sentence;
        } else {
          chunk += (chunk ? ' ' : '') + sentence;
        }
      }
      if (chunk.trim()) chunks.push(chunk.trim());

      // 如果单个句子仍然过长，强制按字符数切分
      return chunks.flatMap(c => {
        if (c.length <= maxSize) return [c];
        const forceChunks: string[] = [];
        for (let i = 0; i < c.length; i += maxSize) {
          forceChunks.push(c.substring(i, i + maxSize));
        }
        return forceChunks;
      });
    };

    for (const part of parts) {
      // 如果单个段落超过限制，强制分割
      if (part.length > chunkSize) {
        if (current) flush();
        const subParts = splitLargePart(part, chunkSize);
        merged.push(...subParts);
        continue;
      }

      if (current && (current.length + part.length + 2) > chunkSize) {
        flush();
      }
      current = current ? `${current}\n\n${part}` : part;
    }

    flush();
    return merged.length > 0 ? merged : parts;
  }

  // 智能分段：基于 Markdown 语法结构
  private smartSegment(text: string): string[] {
    const lines = text.split('\n');
    const segments: string[] = [];
    let currentSegment: string[] = [];
    let inCodeBlock = false;

    const flushSegment = () => {
      const segment = currentSegment.join('\n').trim();
      if (segment) {
        segments.push(segment);
      }
      currentSegment = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检测代码块边界
      if (trimmedLine.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        currentSegment.push(line);
        continue;
      }

      // 在代码块内不分段
      if (inCodeBlock) {
        currentSegment.push(line);
        continue;
      }

      // 检测分段标记
      const isHeading = /^#{1,6}\s+/.test(trimmedLine); // 标题
      const isHorizontalRule = /^(---+|===+|\*\*\*+)$/.test(trimmedLine); // 水平分割线
      const isEmptyLine = trimmedLine === '';

      // 遇到标题或水平线，结束当前段落并开始新段落
      if ((isHeading || isHorizontalRule) && currentSegment.length > 0) {
        flushSegment();
      }

      if (!isEmptyLine || currentSegment.length > 0) {
        currentSegment.push(line);
      }

      // 遇到水平线后立即开始新段落
      if (isHorizontalRule) {
        flushSegment();
      }

      // 遇到连续空行，结束当前段落
      if (isEmptyLine && i > 0 && lines[i - 1].trim() === '' && currentSegment.length > 0) {
        flushSegment();
      }
    }

    flushSegment();
    return segments.length > 0 ? segments : [text];
  }

}