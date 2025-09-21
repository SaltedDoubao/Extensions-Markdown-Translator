# 一、总体架构（概览）

1. 激活层（extension）：注册命令、读取配置、与 VSCode API 交互（打开文件、替换文本、显示通知/进度）。
2. 翻译器核心（translator）：负责把输入文本切分成可翻译块、合并结果、保留 Markdown 结构（代码块、表格、前置标记等）。
3. 翻译 API 客户端（apiClient）：与翻译后端（本地翻译服务、第三方翻译 API 或 LLM）做 HTTP 请求，支持速率限制、重试。
4. 缓存层（cache）：避免重复翻译（基于哈希或文本段 id）。
5. 工具/辅助（utils）：语言检测、分片器、映射保留块（例如 code fences、front-matter）、差异合并等。
6. 日志/错误监控：便于排查。

# 二、设计要点（实现细节）

* **保留 Markdown 结构**：不要直接送整块 Markdown 到翻译器，要先把代码块、表格、行内代码、HTML 注入、YAML front-matter 等抽离或标记为占位符，翻译后再恢复。
* **分片**：如果机器翻译或 LLM 有长度限制（token 或字符），需要把文本按语义分片（以段落为单位，避免在句中拆分）。
* **并发与限速**：对 API 请求做并发控制（如 p-limit）和重试（带指数退避）。
* **缓存**：对每个源段使用哈希（例如 SHA256）作为 key，缓存翻译结果以减少 API 调用并支持离线回滚。
* **差异应用**：翻译后只替换被翻译的部分，保留其它元数据与格式。
* **回退策略**：当翻译失败时可以保留原文并提示用户或尝试备用翻译服务。
* **用户配置**：目标语言、API key、并发数、是否覆盖原文件或生成副本（例如 `README_zh_CN.md`）等。

# 三、核心代码（TypeScript，适用于 VSCode 插件）

下面示例包含三个文件：`extension.ts`（插件入口）, `translator.ts`（翻译流程）, `apiClient.ts`（翻译 API 客户端）。可直接放到 `src/` 目录下并在 `package.json` 注册命令。

---

`src/extension.ts`

```ts
import * as vscode from 'vscode';
import { Translator } from './translator';

export function activate(context: vscode.ExtensionContext) {
  const translator = new Translator(context);

  const disposable = vscode.commands.registerCommand('mdtranslate.translateCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('请打开一个 Markdown 文件再运行翻译命令。');
      return;
    }
    const doc = editor.document;
    if (doc.languageId !== 'markdown' && !doc.fileName.endsWith('.md')) {
      const proceed = await vscode.window.showWarningMessage('当前文件并非 Markdown。是否继续翻译？', '继续', '取消');
      if (proceed !== '继续') return;
    }

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const targetLang = config.get<string>('targetLanguage', 'zh-CN');
    const createNewFile = config.get<boolean>('createNewFile', true);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: '正在翻译 Markdown', cancellable: true },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          translator.cancel();
        });
        try {
          progress.report({ message: '准备中...' });
          const src = doc.getText();
          const result = await translator.translateMarkdown(src, { targetLang, progress, token });
          if (token.isCancellationRequested) {
            vscode.window.showWarningMessage('翻译已取消');
            return;
          }
          if (createNewFile) {
            const newUri = doc.uri.with({ path: doc.uri.path.replace(/\.md$/, `_ ${targetLang}.md`) });
            const newDoc = await vscode.workspace.openTextDocument({ content: result, language: 'markdown' });
            await vscode.window.showTextDocument(newDoc, { preview: false });
          } else {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(src.length));
            edit.replace(doc.uri, fullRange, result);
            await vscode.workspace.applyEdit(edit);
            await doc.save();
          }
          vscode.window.showInformationMessage('翻译完成 ✅');
        } catch (err: any) {
          vscode.window.showErrorMessage('翻译失败: ' + (err?.message ?? String(err)));
        }
      }
    );
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {
  // nothing
}
```

---

`src/translator.ts`

````ts
import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import crypto from 'crypto';

type ProgressReporter = { report: (p: { message?: string; increment?: number }) => void };
type CancelToken = { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => void };

export class Translator {
  private api: ApiClient;
  private cancelled = false;
  private cache = new Map<string, string>(); // 简单内存缓存, 可替换为 persistent storage

  constructor(private context: vscode.ExtensionContext) {
    this.api = new ApiClient(context);
  }

  cancel() {
    this.cancelled = true;
    this.api.cancelOngoing();
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
      if (token?.isCancellationRequested || this.cancelled) throw new Error('用户取消翻译');
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
````

---

`src/apiClient.ts`

```ts
import * as vscode from 'vscode';
import fetch from 'node-fetch'; // 插件打包时需注意 node-fetch 的打包问题，或用 axios

export class ApiClient {
  private ongoingAbort: AbortController | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  cancelOngoing() {
    this.ongoingAbort?.abort();
  }

  async translate(text: string, targetLang: string): Promise<string> {
    // 读取配置
    const cfg = vscode.workspace.getConfiguration('mdTranslator');
    const apiUrl = cfg.get<string>('apiUrl') || '';
    const apiKey = cfg.get<string>('apiKey') || '';

    // 基本保护：若未配置 API，抛异常或采用本地回退
    if (!apiUrl) {
      throw new Error('未配置翻译 API 地址 (mdTranslator.apiUrl)');
    }

    // 控制超时/中止
    this.ongoingAbort = new AbortController();
    const signal = this.ongoingAbort.signal;

    // 构建请求体（以通用 JSON 为例）
    const body = {
      q: text,
      target: targetLang,
      format: 'text',
    };

    // 简单重试逻辑
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey ? `Bearer ${apiKey}` : '',
          },
          body: JSON.stringify(body),
          signal,
        });
        if (!res.ok) {
          const textErr = await res.text().catch(() => '');
          throw new Error(`翻译 API 返回 ${res.status}: ${textErr}`);
        }
        const json = await res.json();
        // 假设返回 { translatedText: "..." }，根据你实际 API 调整解析
        if (json?.translatedText) return json.translatedText as string;
        // 兼容其他字段名
        if (json?.data?.translations?.[0]?.translatedText) return json.data.translations[0].translatedText;
        throw new Error('无法解析翻译 API 返回结果');
      } catch (err: any) {
        if (err.name === 'AbortError') throw new Error('请求已取消');
        if (attempt < maxRetries) {
          // 指数退避
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('翻译失败（重试后）');
  }
}
```

# 四、配置（`package.json` 与 `settings`）

在 `package.json` 中注册命令和配置项，例如：

```json
"contributes": {
  "commands": [
    {
      "command": "mdtranslate.translateCurrentFile",
      "title": "Translate Markdown (mdTranslator)"
    }
  ],
  "configuration": {
    "type": "object",
    "title": "Markdown Translator",
    "properties": {
      "mdTranslator.apiUrl": {
        "type": "string",
        "description": "翻译 API 的 URL（POST）。"
      },
      "mdTranslator.apiKey": {
        "type": "string",
        "description": "翻译 API Key（可选）。"
      },
      "mdTranslator.targetLanguage": {
        "type": "string",
        "default": "zh-CN",
        "description": "目标语言（如 zh-CN、en-US）"
      },
      "mdTranslator.createNewFile": {
        "type": "boolean",
        "default": true,
        "description": "翻译后是否创建新文件而不是覆盖原文件。"
      }
    }
  }
}
```

# 五、进阶功能（建议）

1. **保持术语表（glossary）**：允许用户上传术语表（JSON/CSV），在翻译时优先替换或强制保留术语。
2. **翻译记忆（TM）**：长期持久化缓存（SQLite / LevelDB）并支持相似句匹配（fuzzy）。
3. **差异比对 UI**：翻译前后可视化差异，并允许逐段人工校正（inline suggestion）。
4. **并发与批量处理**：批量文件翻译，队列 + 并发限制。
5. **检测并显示成本/字符统计**：当用付费 API 时给用户估算费用。
6. **支持多后端（插件式后端驱动）**：可插拔不同翻译引擎（Google, DeepL, OpenAI, 本地模型）。
7. **单元测试**：对分片、占位提取/恢复编写单元测试。

# 六、常见陷阱与注意事项

* **不要直接把整篇 Markdown 发给 LLM**：会导致代码段被翻译、格式丢失或超限；应先占位保留。
* **编码/字符集**：确保请求/文件使用 UTF-8。
* **API 返回格式差异**：不同翻译服务返回的 JSON 结构不同，写适配层。
* **打包时依赖问题**：VSCode 插件打包会把 node-fetch/axios 等与 webpack 打包冲突，注意配置 `bundleDependencies` 或使用内置 `https`。
* **隐私与安全**：如果翻译敏感内容，应提供“本地模型”或明确告知用户会把文本发送给第三方。
* **速率限制 & 错误重试**：做好退避和友好报错，避免短时间大量请求导致 IP 被封。

# 七、示例用法（快速上手）

1. 在 VSCode 扩展模板里把上面 `src/*` 文件加入并编译。
2. 在 Settings 里配置 `mdTranslator.apiUrl`（例如公司内部翻译服务或自己封装的 API）。
3. 打开 `README.md`，在命令面板运行 `Translate Markdown (mdTranslator)`。
4. 翻译完成后会在新文件或覆盖原文件。
