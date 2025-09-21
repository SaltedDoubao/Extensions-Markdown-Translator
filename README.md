# Extensions Markdown Translator

一款用于翻译vscode扩展详情页README文档的插件

## 关于项目

### 预期功能
* 保证不会破坏md文档结构的前提下提高翻译质量
* 能够翻译vscode扩展详情页的README.md与CHANGELOG.md
* 支持多种翻译服务和LLM API

### 目前项目有几个问题待解决
* **预期功能未实现** 项目仍然不能翻译插件详情页内容

### 施工计划
* 在main分支中暂时移除文本处理逻辑以保证可用性（直接将文档分段发送给LLM）
* 在ts分支中尝试修复原有的翻译与文本处理逻辑
* 在py分支中尝试使用python重构翻译逻辑