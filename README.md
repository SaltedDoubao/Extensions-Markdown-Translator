# [EMT] Extensions Markdown Translator

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=markdown-translator.markdown-translator)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![VSCode](https://img.shields.io/badge/vscode-^1.74.0-blue.svg)](https://code.visualstudio.com/)

您是否在浏览插件介绍时对长篇大论的外语介绍感到无从下手？或许可以试试这款插件！

## ✨ 预期功能

> 目前**尚未实现**对扩展详情页的翻译，但仍然可作为**Markdown翻译工具**使用

- 快速翻译扩展详情页，提高您浏览扩展介绍的效率

## 🛠️ 支持的翻译引擎

| 引擎 | 类型 | 描述 |
|------|------|------|
| Google Translate | 传统API | 免费配额，快速稳定 |
| Microsoft Translator | 传统API | 企业级服务 |
| OpenAI API | LLM | OpenAI 模型 |
| Anthropic API | LLM | Claude 模型 |
| Gemini API | LLM | Google 模型 |
| Zhipu API | LLM | 智谱 GLM 模型 |
| Grok API | LLM | xAI 模型 |
| OpenAI Compatible API | LLM | 支持各种兼容OpenAI API 的接口|
| Ollama | 本地LLM | 本地部署AI模型 |
| LM Studio | 本地LLM | 本地部署AI模型 |

## 📥 安装使用

### 方法一：本地编译运行
1. 克隆此项目
```
git clone https://github.com/SaltedDoubao/Extensions-Markdown-Translator.git
```
```
cd Extensions-Markdown-Translator
```
2. 编译此项目
```
npm run compile
```
3. 使用 vscode 打开项目并按 F5 进行调试

### 方法二：从 VSIX 安装
1. 从 [Releases](https://github.com/SaltedDoubao/Extensions-Markdown-Translator/releases) 获取最新版vsix文件
2. 打开 vscode - 扩展 - 视图和更多操作 - 从vsix安装
3. 找到并打开vsix文件

## 🚀 快速开始

### 1️⃣ 配置翻译引擎
1. 使用 `Ctrl+Shift+P` 打开命令面板
2. 输入 "Markdown Translator: 打开配置页面"
3. 选择翻译引擎并配置API密钥

### 2️⃣ 基本使用
1. 打开任意Markdown文件
2. 点击编辑器右上角的 **翻译** 按钮
3. 等待翻译完成，自动生成翻译后文件

### 3️⃣ 编辑器按钮说明
- **翻译** - 开始翻译当前文档
- **返回** - 恢复到原始文档
- **再次翻译** - 清除翻译缓存并重新翻译

## ⚙️ 高级选项

### 📊 智能分段
- **Markdown 语法识别**：自动识别标题（`# Heading`）、水平分割线（`---`）等结构进行智能分段
- **代码块保护**：翻译时自动跳过代码块内容，保持代码块完整性
- **超长段落处理**：自动按句子分割超长段落，避免单段过长导致超时

### 🚀 队列翻译模式（推荐）
- **默认启用**：使用队列机制按顺序逐段翻译，避免触发 API 限流
- **自动重试**：翻译失败时自动重试（默认 3 次），提高成功率
- **实时进度**：显示当前翻译进度和队列状态

### 📦 长上下文优化
- **分批翻译**：在设置中勾选后，会自动按批次翻译超长文档并逐步写入，避免上下文截断或超时
- **可配置大小**：可配置每批最大字符数（默认 5000，范围 500-20000）

### 🔧 配置说明
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `useTranslationQueue` | `true` | 启用队列翻译模式，推荐保持开启 |
| `retryAttempts` | `3` | 翻译失败时的重试次数 |
| `longContextOptimization` | `false` | 启用长文档逐步写入模式 |
| `longContextChunkSize` | `5000` | 每批最大字符数 |

## 🚧 施工计划

- [ ] 自动识别翻译语言
- [ ] 免费翻译服务集成
- [ ] 扩展详情页翻译支持

## 🤝 贡献指南

欢迎提交Issue和PR！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b [feature_name]`)
3. 提交更改 (`git commit -m 'commit message'`)
4. 推送分支 (`git push origin [feature_name]`)

## 🏛️ 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](https://github.com/SaltedDoubao/Extensions-Markdown-Translator/blob/main/LICENSE) 文件

## 💬 支持与反馈

- 🐛 **问题反馈**：[GitHub Issues](https://github.com/SaltedDoubao/Extensions-Markdown-Translator/issues)

---

<div align="center">

⭐ **如果这个项目对你有帮助，请给一个Star！**

</div>
