# Markdown Translator 项目开发规范

## 项目结构

```
Extensions-Markdown-Translator/
├── src/                           # 源代码目录
│   ├── extension.ts               # 主入口文件
│   ├── translator.ts              # 翻译主服务
│   ├── settingsWebviewProvider.ts # 设置页面提供者
│   ├── apiClient.ts               # API 客户端
│   ├── services/                  # 服务层
│   │   ├── extensionTranslationManager.ts      # 扩展翻译管理器
│   │   └── extensionTranslationWebviewProvider.ts  # 扩展翻译 Webview
│   ├── engines/                   # 翻译引擎
│   │   ├── baseEngine.ts          # 基础引擎接口
│   │   ├── baseLLMEngine.ts       # LLM引擎基类
│   │   ├── googleTranslate.ts     # Google翻译
│   │   ├── microsoftTranslate.ts  # Microsoft翻译
│   │   ├── openaiEngine.ts        # OpenAI GPT
│   │   ├── claudeEngine.ts        # Anthropic Claude
│   │   ├── geminiEngine.ts        # Google Gemini
│   │   ├── zhipuEngine.ts         # Zhipu AI
│   │   ├── xaiEngine.ts           # xAI Grok
│   │   ├── openaiCompatibleEngine.ts  # OpenAI兼容API
│   │   ├── ollamaEngine.ts        # Ollama
│   │   ├── lmStudioEngine.ts      # LM Studio
│   │   └── engineManager.ts       # 引擎管理器
│   ├── utils/                     # 工具类
│   │   └── secretStorage.ts       # 安全存储管理
│   └── images/                    # 图标资源
│       ├── run.ico                # 运行图标
│       ├── back.ico               # 返回图标
│       ├── redo.ico               # 重做图标
│       └── pass.ico               # 通过图标
├── out/                           # 编译输出目录
├── docs/                          # 文档目录
│   ├── 使用指南.md                # 用户使用指南
│   └── 项目开发规范.md            # 开发规范文档
├── .vscode/                       # VSCode配置
├── .cursor/                       # Cursor配置
├── TestMarkdown/                  # 测试Markdown文件
├── package.json                   # 扩展清单
├── tsconfig.json                  # TypeScript配置
└── README.md                      # 项目说明
```

## 开发环境设置

### 1. 安装依赖
```bash
npm install
```

### 2. 编译项目
```bash
npm run compile
```

### 3. 监视模式（开发时）
```bash
npm run watch
```

### 4. 代码检查
```bash
npm run lint
```

## 调试和测试

### 1. 启动调试
1. 在 VSCode 中打开项目
2. 按 F5 或使用 "Run Extension" 配置
3. 会打开一个新的 VSCode 窗口（扩展开发宿主），插件已加载

### 2. 测试功能
1. 在扩展开发宿主中打开 `TestMarkdown/test-sample.md` 文件
2. 点击编辑器标题栏的"翻译"按钮
3. 测试"返回"和"再次翻译"功能

### 3. 配置测试
1. 使用命令面板执行"Markdown Translator: 打开配置页面"
2. 配置不同的翻译引擎 API 密钥
3. 使用"测试连接"按钮验证配置

## 核心架构

### 翻译引擎架构
```
TranslationEngineManager
├── GoogleTranslateEngine      (免费，需要 API 密钥)
├── MicrosoftTranslateEngine   (需要 API 密钥和区域)
├── OpenAIEngine               (需要 API 密钥，支持 GPT-4/5 系列)
├── ClaudeEngine               (需要 API 密钥，支持自定义 Base URL)
├── GeminiEngine               (需要 API 密钥)
├── ZhipuEngine                (需要 API 密钥，智谱 AI)
├── XAIEngine                  (需要 API 密钥，xAI Grok)
├── OpenAICompatibleEngine     (兼容 OpenAI API 格式的服务)
├── OllamaEngine               (本地 Ollama 服务)
└── LMStudioEngine             (本地 LM Studio 服务)
```

### 处理流程
1. **内容解析**: Translator 解析 Markdown 文档结构
2. **智能过滤**: 跳过代码块、链接、图片等不需翻译的部分
3. **批量翻译**: 通过选定的引擎处理翻译请求
4. **长文档优化**: 支持分批翻译长文档，避免超时
5. **内容重组**: 将翻译结果重新组装为完整文档
6. **文件管理**: 支持创建新文件或覆盖原文件

## 添加新的翻译引擎

### 步骤 1: 创建引擎实现

在 `src/engines/` 目录下创建新的引擎文件，例如 `xaiEngine.ts`：

```typescript
import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class XAIEngine extends BaseLLMEngine {
  name = 'xAI Grok';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('xai');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('xaiModel', 'grok-4-0709');

    if (!apiKey) {
      throw new Error('xAI API key not configured');
    }

    const url = 'https://api.x.ai/v1/chat/completions';

    const body = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1,
      max_tokens: Math.min(4096, text.length * 3)
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body
      });

      if (response.choices?.[0]?.message?.content) {
        return this.cleanLLMResponse(response.choices[0].message.content);
      } else {
        throw new Error('Invalid response format from xAI');
      }
    } catch (error) {
      throw new Error(`xAI API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    return secretStorage.hasApiKeySync('xai');
  }

  async validateConfig(): Promise<boolean> {
    try {
      const secretStorage = getSecretStorageManager();
      const apiKey = await secretStorage.getApiKeyWithFallback('xai');
      if (!apiKey) {
        return false;
      }

      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('xaiModel', 'grok-4-0709');
      const url = 'https://api.x.ai/v1/chat/completions';

      const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0
      });

      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body
      });

      return !!(response && (response.id || response.choices));
    } catch {
      return false;
    }
  }
}
```

### 步骤 2: 在引擎管理器中注册

在 `src/engines/engineManager.ts` 中：

1. 导入新引擎：
```typescript
import { XAIEngine } from './xaiEngine';
```

2. 更新 `EngineType` 类型：
```typescript
export type EngineType = 'google' | 'microsoft' | 'openai' | 'claude' | 'gemini' | 'openai-compatible' | 'zhipu' | 'xai' | 'ollama' | 'lm-studio';
```

3. 在 `initializeEngines()` 方法中注册：
```typescript
this.engines.set('xai', new XAIEngine());
```

4. 更新显示名称：
```typescript
getEngineDisplayNames(): Record<EngineType, string> {
  return {
    // ...其他引擎
    'xai': 'xAI Grok',
  };
}
```

5. 添加配置字段：
```typescript
getEngineConfigFields(type: EngineType): string[] {
  switch (type) {
    // ...其他引擎
    case 'xai':
      return ['xaiApiKey', 'xaiModel'];
  }
}
```

6. 标记为 LLM 引擎（如果适用）：
```typescript
isLLMEngine(type: EngineType): boolean {
  return ['openai', 'claude', 'gemini', 'openai-compatible', 'zhipu', 'xai', 'ollama', 'lm-studio'].includes(type);
}
```

### 步骤 3: 添加配置项

在 `package.json` 的 `contributes.configuration.properties` 中添加：

```json
"mdTranslator.defaultEngine": {
  "enum": [
    "google",
    "microsoft",
    "openai",
    "claude",
    "gemini",
    "openai-compatible",
    "zhipu",
    "xai",
    "ollama",
    "lm-studio"
  ],
  "enumDescriptions": [
    "Google Translate",
    "Microsoft Translator",
    "OpenAI GPT",
    "Anthropic Claude",
    "Google Gemini",
    "OpenAI Compatible API",
    "Zhipu AI",
    "xAI Grok",
    "Ollama",
    "LM Studio"
  ]
},
"mdTranslator.xaiApiKey": {
  "type": "string",
  "default": "",
  "description": "xAI API密钥"
},
"mdTranslator.xaiModel": {
  "type": "string",
  "default": "grok-4-0709",
  "description": "xAI模型名称"
}
```

### 步骤 4: 更新 Webview 设置页面

在 `src/settingsWebviewProvider.ts` 中：

1. 在引擎选择下拉框中添加选项
2. 添加引擎配置区域的 HTML
3. 在 JavaScript 的 `saveSettings()` 函数中添加字段
4. 在 `loadSettings()` 消息处理中添加字段加载
5. 在 `loadCurrentSettings()` 方法中从配置读取
6. 在 `saveSettings()` 方法中保存到配置和安全存储

## 代码规范

### TypeScript 规范
- 使用严格模式 (`strict: true`)
- 所有函数参数和返回值必须有类型注解
- 使用 `async/await` 处理异步操作
- 优先使用 `const`，需要重新赋值时使用 `let`
- 避免使用 `any` 类型，使用具体类型或泛型

### 命名规范
- 类名：PascalCase（如 `TranslationEngine`）
- 接口名：PascalCase，通常不加 `I` 前缀
- 函数/方法名：camelCase（如 `translateText`）
- 变量名：camelCase（如 `apiKey`）
- 常量：UPPER_SNAKE_CASE 或 camelCase
- 文件名：camelCase（如 `xaiEngine.ts`）

### 错误处理
- 所有 API 调用必须包含 try-catch
- 错误信息应该清晰明确，包含上下文
- 使用 `vscode.window.showErrorMessage()` 向用户显示错误

### 安全性
- API 密钥使用 `SecretStorage` 安全存储
- 支持从安全存储读取，并有配置文件回退机制
- 不在日志中输出敏感信息

## 配置选项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| defaultEngine | string | "google" | 默认翻译引擎 |
| targetLanguage | string | "zh-CN" | 目标语言代码 |
| createNewFile | boolean | true | 翻译后创建新文件 |
| longContextOptimization | boolean | false | 启用长上下文优化 |
| longContextChunkSize | number | 5000 | 分批翻译的字符数 |
| googleApiKey | string | "" | Google Translate API密钥 |
| microsoftApiKey | string | "" | Microsoft Translator API密钥 |
| microsoftRegion | string | "global" | Microsoft服务区域 |
| openaiApiKey | string | "" | OpenAI API密钥 |
| openaiModel | string | "gpt-5" | OpenAI模型名称 |
| claudeApiKey | string | "" | Claude API密钥 |
| claudeBaseUrl | string | "https://api.anthropic.com" | Claude API基础URL |
| claudeModel | string | "claude-sonnet-4-20250514" | Claude模型名称 |
| geminiApiKey | string | "" | Gemini API密钥 |
| geminiModel | string | "gemini-2.5-flash" | Gemini模型名称 |
| zhipuApiKey | string | "" | Zhipu API密钥 |
| zhipuModel | string | "glm-4-flash" | Zhipu模型名称 |
| xaiApiKey | string | "" | xAI API密钥 |
| xaiModel | string | "grok-4-0709" | xAI模型名称 |
| openaiCompatibleApiKey | string | "" | OpenAI兼容API密钥 |
| openaiCompatibleBaseUrl | string | "" | OpenAI兼容API基础URL |
| openaiCompatibleModel | string | "gpt-4o-mini" | OpenAI兼容API模型 |
| ollamaBaseUrl | string | "http://localhost:11434" | Ollama服务URL |
| ollamaModel | string | "" | Ollama模型名称 |
| lmStudioBaseUrl | string | "http://localhost:1234" | LM Studio服务URL |
| lmStudioModel | string | "" | LM Studio模型名称 |

## 打包发布

### 1. 更新版本号
在 `package.json` 中更新版本号。

### 2. 打包扩展
```bash
npm run package
```
这将生成 `.vsix` 文件。

### 3. 发布到市场
```bash
vsce publish
```

## 故障排除

### 常见问题

1. **编译错误**
   - 确保所有依赖已安装：`npm install`
   - 检查 TypeScript 版本兼容性
   - 清理并重新编译：`rm -rf out && npm run compile`

2. **翻译失败**
   - 检查网络连接
   - 验证 API 密钥配置是否正确
   - 查看 VSCode 开发者控制台错误信息（Help > Toggle Developer Tools）
   - 使用设置页面的"测试连接"功能

3. **插件不加载**
   - 检查 `package.json` 配置是否正确
   - 确保编译成功，`out` 目录存在且包含编译后的 `.js` 文件
   - 检查 `activationEvents` 是否正确配置

4. **安全存储问题**
   - API 密钥优先从 VSCode 的 SecretStorage 读取
   - 如果安全存储不可用，会回退到配置文件
   - 可以在设置页面重新保存配置以更新安全存储

## 贡献指南

1. Fork 项目
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 创建 Pull Request

### 代码审查标准
- 所有代码必须通过 TypeScript 编译
- 必须通过 ESLint 检查
- 新功能应包含适当的错误处理
- 重要功能应更新相关文档

## 技术栈

- **TypeScript**: 主要开发语言
- **VSCode Extension API**: 扩展开发框架
- **Axios**: HTTP 请求库
- **crypto-js**: 加密库（用于某些 API 的签名）

## 性能优化建议

- **请求延迟**: 避免 API 频率限制
- **错误重试**: 实现自动重试机制
- **长文档处理**: 使用 `longContextOptimization` 分批翻译
- **异步处理**: 利用 Promise.all 并发处理多个请求
- **缓存机制**: 可考虑添加翻译缓存（未实现）

## 支持的引擎列表

| 引擎名称 | 类型 | 是否需要密钥 | 特点 |
|---------|------|------------|------|
| Google Translate | 传统翻译 | 是 | 支持多语言，速度快 |
| Microsoft Translator | 传统翻译 | 是 | 支持区域配置 |
| OpenAI GPT | LLM | 是 | 理解上下文，翻译质量高 |
| Anthropic Claude | LLM | 是 | 支持自定义 Base URL |
| Google Gemini | LLM | 是 | Google 的 AI 模型 |
| Zhipu AI | LLM | 是 | 国内 AI 服务 |
| xAI Grok | LLM | 是 | xAI 的 Grok 系列模型 |
| OpenAI Compatible | LLM | 是 | 兼容 OpenAI API 格式的服务 |
| Ollama | LLM | 否 | 本地运行的 AI 模型 |
| LM Studio | LLM | 否 | 本地 AI 模型服务 |

## 版本历史

查看 [releases] 了解各版本的更新内容。

