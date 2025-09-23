# [EMT] Extensions Markdown Translator

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=markdown-translator.markdown-translator)
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
| OpenAI Compatible API | LLM | 支持各种兼容OpenAI API 的接口|
| Ollama | 本地LLM | 本地部署AI模型 |
| LM Studio | 本地LLM | 本地部署AI模型 |

## 📥 安装使用

### 方法一：VSCode 扩展商店安装
1. 打开 VSCode
2. 进入扩展页面 (`Ctrl+Shift+X`)
3. 搜索 "Markdown Translator"
4. 点击安装

### 方法二：从 VSIX 安装
1. 从 [Releases](https://github.com/SaltedDoubao/markdown-translator/releases) 获取最新版vsix文件
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

## 🚧 施工计划

- [ ] 配置文件加密
- [ ] 修复API连接测试
- [ ] 免费翻译服务集成
- [ ] 扩展详情页翻译支持
- [ ] 长文档上下文优化

## 🤝 贡献指南

欢迎提交Issue和PR！

1. Fork本仓库
2. 创建特性分支 (`git checkout -b [feature_name]`)
3. 提交更改 (`git commit -m 'commit message'`)
4. 推送分支 (`git push origin [feature_name]`)

## 🏛️ 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 💬 支持与反馈

- 🐛 **问题反馈**：[GitHub Issues](https://github.com/SaltedDoubao/markdown-translator/issues)

---

<div align="center">

⭐ **如果这个项目对你有帮助，请给一个Star！**

</div>