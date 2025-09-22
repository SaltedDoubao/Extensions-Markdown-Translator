import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import * as crypto from 'crypto';

type ProgressReporter = { report: (p: { message?: string; increment?: number }) => void };
type CancelToken = { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => void };

export class Translator {
  private api: ApiClient;
  private cancelled = false;
  private translating = false;
  private cache = new Map<string, string>(); // 简单内存缓存, 可替换为 persistent storage

  constructor(private context: vscode.ExtensionContext) {
    this.api = new ApiClient(context);
  }

  cancel() {
    this.cancelled = true;
    this.api.cancelOngoing();
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
    opts: { targetLang: string; progress?: ProgressReporter; token?: CancelToken }
  ): Promise<string> {
    this.cancelled = false;
    this.translating = true;

    try {
      const { targetLang, progress, token } = opts;
      // 1. 抽取并替换占位（保留 code fences, inline code, tables 等）
      progress?.report({ message: '提取不可翻译块...' });
      const { placeholderText, placeholders } = this.extractPlaceholders(markdown);

      // 2. 分段（以空行分隔）并构建翻译任务
      progress?.report({ message: '分段并准备翻译...' });
      const segments = this.segmentText(placeholderText);

      // 3. 逐段翻译（支持缓存与并发控制）
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
          translatedSegments.push(t);
        }
        done++;
      }

      // 4. 合并译文并恢复占位符
      progress?.report({ message: '合并译文并恢复格式...' });
      const joined = translatedSegments.join('\n\n');
      const restored = this.restorePlaceholders(joined, placeholders);
      return restored;
    } finally {
      this.translating = false;
    }
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

  private segmentText(text: string): string[] {
    // 简单以两个换行分割段落，同时去除超长空行
    const parts = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    // 如果段落过长，可进一步按句号或限定字符数切分（此处留给扩展）
    return parts;
  }
}