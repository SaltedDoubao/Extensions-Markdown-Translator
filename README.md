# Markdown Translator

一款功能强大的VSCode插件，专为markdown文档翻译而设计。支持多种翻译引擎和LLM API，提供智能的内容过滤和批量翻译功能。

## 功能特性

### ✨ 核心功能
- **多引擎支持**: Google翻译、百度翻译、OpenAI、Claude等多种翻译引擎
- **智能过滤**: 自动识别并跳过代码块、内联代码、链接等不需要翻译的内容
- **中英互译**: 自动检测文档语言，智能选择翻译方向
- **批量翻译**: 支持整个文档的批量翻译处理
- **选择翻译**: 支持选中文本的快速翻译

### 🎯 智能特性
- **自动检测**: 智能检测文档主要语言
- **内容保护**: 保护markdown格式、代码块、链接结构不被破坏
- **自动翻译**: 可配置打开md文件时自动翻译
- **右键菜单**: 集成到编辑器右键菜单，操作便捷

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

#### Claude
- `claudeApiKey`: Claude API密钥

## 支持的翻译引擎

| 引擎 | 特点 | 配置要求 |
|------|------|----------|
| Google翻译 | 免费、快速 | 无需配置 |
| 百度翻译 | 准确度高 | 需要APP ID和密钥 |
| OpenAI | AI驱动、质量好 | 需要API密钥 |
| Claude | AI驱动、理解力强 | 需要API密钥 |

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
│   └── translatorService.ts  # 翻译服务
├── engines/              # 翻译引擎
│   ├── googleTranslator.ts
│   ├── baiduTranslator.ts
│   ├── openaiTranslator.ts
│   └── claudeTranslator.ts
└── utils/
    └── markdownProcessor.ts   # Markdown处理器
```

## 版本历史

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
