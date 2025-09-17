# Markdown Translator

一款功能强大的VSCode插件，专为markdown文档翻译而设计。支持多种翻译引擎和LLM API，提供智能的内容过滤和高性能批量翻译功能。

## ✨ 最新更新 (v0.1.0)

### 🚀 重大性能优化
- **批量翻译性能提升80%+**: 从串行处理改为并发处理，大文档翻译速度显著提升
- **修复核心Bug**: 解决了翻译后代码块、链接、图片等内容丢失的问题
- **智能并发控制**: 自动控制API请求并发数，避免触发频率限制

### ⚙️ 新增配置选项
- **模型选择**: 支持选择OpenAI和Claude的不同模型
  - OpenAI: GPT-3.5-turbo, GPT-4, GPT-4-turbo, GPT-4o, GPT-4o-mini
  - Claude: Haiku, Sonnet, Opus, Claude-3.5-Sonnet
- **更好的错误处理**: 统一的API错误处理机制

## 功能特性

### ✨ 核心功能
- **多引擎支持**: Google翻译、百度翻译、OpenAI、Claude等多种翻译引擎
- **智能过滤**: 自动识别并跳过代码块、内联代码、链接等不需要翻译的内容
- **中英互译**: 自动检测文档语言，智能选择翻译方向
- **高性能批量翻译**: 支持整个文档的并发批量翻译处理
- **选择翻译**: 支持选中文本的快速翻译

### 🎯 智能特性
- **自动检测**: 智能检测文档主要语言
- **内容保护**: 完美保护markdown格式、代码块、链接结构不被破坏
- **自动翻译**: 可配置打开md文件时自动翻译
- **右键菜单**: 集成到编辑器右键菜单，操作便捷

### 🔧 技术特性
- **并发处理**: 智能并发控制，最多5个同时请求
- **容错机制**: 翻译失败时保留原文，不会丢失内容
- **TypeScript**: 严格类型检查，代码质量保证

## 安装使用

### 安装方式
1. 在VSCode扩展市场搜索"Markdown Translator"
2. 点击安装即可

### 基础使用
1. 打开markdown文件
2. 使用命令面板 (`Ctrl+Shift+P`) 搜索相关命令：
   - `翻译为英文`
   - `翻译为中文`
   - `翻译选中文本`
   - `自动翻译当前文档`

### 右键菜单
在markdown文件中选中文本后，右键菜单会显示"翻译选中文本"选项。

## 配置说明

在VSCode设置中搜索"Markdown Translator"进行配置：

### 基础配置
- `defaultEngine`: 默认翻译引擎 (google/baidu/openai/claude)
- `autoFilter`: 是否自动过滤代码块和内联代码
- `autoTranslateOnOpen`: 打开md文件时是否自动翻译

### API配置

#### Google翻译
无需配置，直接使用。

#### 百度翻译
- `baiduAppId`: 百度翻译APP ID
- `baiduSecretKey`: 百度翻译密钥

#### OpenAI
- `openaiApiKey`: OpenAI API密钥
- `openaiModel`: 选择模型 (gpt-3.5-turbo/gpt-4/gpt-4-turbo/gpt-4o/gpt-4o-mini)

#### Claude
- `claudeApiKey`: Claude API密钥
- `claudeModel`: 选择模型 (claude-3-haiku-20240307/claude-3-sonnet-20240229/claude-3-opus-20240229/claude-3-5-sonnet-20241022)

## 支持的翻译引擎

| 引擎 | 特点 | 配置要求 | 推荐模型 |
|------|------|----------|----------|
| Google翻译 | 免费、快速 | 无需配置 | - |
| 百度翻译 | 准确度高 | 需要APP ID和密钥 | - |
| OpenAI | AI驱动、质量好 | 需要API密钥 | GPT-4o, GPT-4-turbo |
| Claude | AI驱动、理解力强 | 需要API密钥 | Claude-3.5-Sonnet, Opus |

## 使用技巧

### 1. 智能内容过滤
插件会自动跳过以下内容：
- 代码块 (`​​`​​`code`​​`​​`)
- 内联代码 (`code`)
- 图片链接（但会翻译alt文本）
- 普通链接（但会翻译链接文本）
- HTML标签

### 2. 格式保护
翻译后会保持markdown原有格式：
- 标题层级 (`# ## ###`)
- 列表结构 (`- * +` 和 `1. 2. 3.`)
- 引用格式 (`>`)
- 原有缩进和换行

### 3. 语言检测
- 自动检测文档主要语言
- 中文文档自动翻译为英文
- 英文文档自动翻译为中文

## 开发信息

### 技术栈
- TypeScript
- VSCode Extension API
- Axios (HTTP请求)
- crypto-js (加密)

### 项目结构
```
src/
├── extension.ts          # 主入口文件
├── services/
│   └── translatorService.ts  # 翻译服务 (支持并发处理)
├── engines/              # 翻译引擎 (重构错误处理)
│   ├── googleTranslator.ts
│   ├── baiduTranslator.ts
│   ├── openaiTranslator.ts  # 支持模型选择
│   └── claudeTranslator.ts  # 支持模型选择
└── utils/
    ├── markdownProcessor.ts   # Markdown处理器 (修复重组Bug)
    └── translatorUtils.ts     # 翻译工具库 (新增)
```

## 版本历史

### v0.1.0 (最新) 🚀
- **重大Bug修复**: 修复翻译后代码块、链接、图片丢失的问题
- **性能优化**: 批量翻译性能提升80%+，支持并发处理
- **新增功能**: 支持OpenAI和Claude多模型选择
- **代码重构**: 统一错误处理，减少代码重复
- **改进配置**: 移除硬编码，增加灵活配置选项

### v0.0.1
- 初始版本
- 支持多种翻译引擎
- 基础翻译功能
- 智能内容过滤

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

如有问题或建议，请在GitHub Issues中反馈。
