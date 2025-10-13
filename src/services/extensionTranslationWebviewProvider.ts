import * as vscode from 'vscode';
import { ExtensionTranslationManager, ExtensionInfo, ExtensionDocs } from './extensionTranslationManager';
import { Translator } from '../translator';

/**
 * 扩展翻译Webview提供者
 */
export class ExtensionTranslationWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private translationManager: ExtensionTranslationManager;
  private translator: Translator;

  constructor(
    private context: vscode.ExtensionContext,
    translationManager: ExtensionTranslationManager,
    translator: Translator
  ) {
    this.translationManager = translationManager;
    this.translator = translator;
  }

  /**
   * 显示扩展翻译界面
   */
  async show(extensionId?: string) {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'extensionTranslator',
      '扩展翻译器',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    // 处理来自webview的消息
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'loadExtension':
            await this.handleLoadExtension(message.extensionId);
            break;
          case 'listInstalledExtensions':
            await this.handleListInstalledExtensions();
            break;
          case 'translateContent':
            await this.handleTranslateContent(message.content, message.type);
            break;
          case 'saveTranslation':
            await this.handleSaveTranslation(message.content, message.type, message.extensionId);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );

    // 如果提供了扩展ID，立即加载
    if (extensionId) {
      // Pre-fill the input and load the extension
      this.sendMessage({ command: 'setInitialExtension', extensionId });
      await this.handleLoadExtension(extensionId);
    } else {
      // 加载已安装扩展列表
      await this.handleListInstalledExtensions();
    }
  }

  /**
   * 处理加载扩展请求
   */
  private async handleLoadExtension(extensionId: string) {
    try {
      this.sendMessage({ command: 'showLoading', message: '正在加载扩展信息...' });

      const extensionInfo = await this.translationManager.getExtensionInfo(extensionId);
      if (!extensionInfo) {
        this.sendMessage({
          command: 'showError',
          message: `未找到扩展: ${extensionId}`
        });
        return;
      }

      this.sendMessage({ command: 'showLoading', message: '正在获取扩展文档...' });
      const docs = await this.translationManager.getExtensionDocs(extensionInfo);

      this.sendMessage({
        command: 'extensionLoaded',
        extensionInfo,
        docs
      });

    } catch (error) {
      this.sendMessage({
        command: 'showError',
        message: `加载扩展失败: ${error}`
      });
    }
  }

  /**
   * 处理列出已安装扩展请求
   */
  private async handleListInstalledExtensions() {
    try {
      const extensions = this.translationManager.getInstalledExtensions();
      this.sendMessage({
        command: 'installedExtensionsLoaded',
        extensions
      });
    } catch (error) {
      this.sendMessage({
        command: 'showError',
        message: `获取扩展列表失败: ${error}`
      });
    }
  }

  /**
   * 处理翻译内容请求
   */
  private async handleTranslateContent(content: string, type: string) {
    try {
      this.sendMessage({
        command: 'translationStarted',
        type,
        message: '正在翻译...'
      });

      const config = vscode.workspace.getConfiguration('mdTranslator');
      const targetLang = config.get<string>('targetLanguage', 'zh-CN');

      const translatedContent = await this.translator.translateMarkdown(content, {
        targetLang,
        progress: {
          report: (value: any) => {
            this.sendMessage({
              command: 'translationProgress',
              type,
              message: value.message || '翻译中...'
            });
          }
        }
      });

      this.sendMessage({
        command: 'translationCompleted',
        type,
        originalContent: content,
        translatedContent
      });

    } catch (error) {
      this.sendMessage({
        command: 'translationError',
        type,
        message: `翻译失败: ${error}`
      });
    }
  }

  /**
   * 处理保存翻译请求
   */
  private async handleSaveTranslation(content: string, type: string, extensionId: string) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        this.sendMessage({
          command: 'showError',
          message: '请先打开一个工作区'
        });
        return;
      }

      const fileName = `${extensionId.replace('.', '_')}_${type}_translated.md`;
      const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);

      await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));

      this.sendMessage({
        command: 'saveCompleted',
        type,
        filePath: filePath.fsPath
      });

      // 打开保存的文件
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);

    } catch (error) {
      this.sendMessage({
        command: 'showError',
        message: `保存失败: ${error}`
      });
    }
  }

  /**
   * 向webview发送消息
   */
  private sendMessage(message: any) {
    this.panel?.webview.postMessage(message);
  }

  /**
   * 获取webview HTML内容
   */
  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>扩展翻译器</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .extension-selector {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
        }
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .extension-info {
            display: none;
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .extension-info.visible {
            display: block;
        }
        .extension-meta {
            margin-bottom: 15px;
        }
        .extension-meta h3 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        .translation-section {
            display: none;
            margin-bottom: 20px;
        }
        .translation-section.visible {
            display: block;
        }
        .content-tabs {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .tab {
            padding: 10px 20px;
            background: none;
            border: none;
            color: var(--vscode-editor-foreground);
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .content-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .content-box {
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            overflow: hidden;
        }
        .content-header {
            padding: 10px 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-widget-border);
            font-weight: 500;
        }
        .content-body {
            padding: 15px;
            max-height: 400px;
            overflow-y: auto;
            background-color: var(--vscode-input-background);
        }
        .content-body pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .error {
            padding: 10px;
            border-radius: 4px;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            margin-bottom: 15px;
        }
        .success {
            padding: 10px;
            border-radius: 4px;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
            margin-bottom: 15px;
        }
        .extensions-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
        }
        .extension-item {
            padding: 10px;
            border-bottom: 1px solid var(--vscode-widget-border);
            cursor: pointer;
        }
        .extension-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .extension-item:last-child {
            border-bottom: none;
        }
        .extension-item h4 {
            margin: 0 0 5px 0;
            font-size: 14px;
        }
        .extension-item p {
            margin: 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 扩展翻译器</h1>
            <p>选择扩展并翻译其README和CHANGELOG文档</p>
        </div>

        <!-- 扩展选择器 -->
        <div class="extension-selector">
            <div class="form-group">
                <label for="extensionInput">扩展ID或Marketplace URL</label>
                <input type="text" id="extensionInput" placeholder="例如: ms-python.python 或 https://marketplace.visualstudio.com/items?itemName=ms-python.python">
            </div>
            <button class="button" onclick="loadExtension()">加载扩展</button>
            <button class="button secondary" onclick="showInstalledExtensions()">选择已安装的扩展</button>

            <div id="installedExtensions" class="extensions-list" style="display: none; margin-top: 15px;">
                <!-- 已安装扩展列表 -->
            </div>
        </div>

        <!-- 状态消息 -->
        <div id="statusMessage"></div>

        <!-- 扩展信息 -->
        <div id="extensionInfo" class="extension-info">
            <div class="extension-meta">
                <h3 id="extensionTitle"></h3>
                <p id="extensionDescription"></p>
                <p><strong>版本:</strong> <span id="extensionVersion"></span> | <strong>发布者:</strong> <span id="extensionPublisher"></span></p>
            </div>
        </div>

        <!-- 翻译区域 -->
        <div id="translationSection" class="translation-section">
            <div class="content-tabs">
                <button class="tab active" onclick="switchTab('readme')">README</button>
                <button class="tab" onclick="switchTab('changelog')">CHANGELOG</button>
            </div>

            <div id="readmeTab" class="tab-content active">
                <div class="content-panel">
                    <div class="content-box">
                        <div class="content-header">
                            原文 (README)
                            <button class="button" style="float: right; padding: 5px 10px; font-size: 12px;" onclick="translateContent('readme')">翻译</button>
                        </div>
                        <div class="content-body">
                            <pre id="readmeOriginal">暂无内容</pre>
                        </div>
                    </div>
                    <div class="content-box">
                        <div class="content-header">
                            译文 (README)
                            <button class="button secondary" style="float: right; padding: 5px 10px; font-size: 12px;" onclick="saveTranslation('readme')">保存</button>
                        </div>
                        <div class="content-body">
                            <pre id="readmeTranslated">点击"翻译"按钮开始翻译</pre>
                        </div>
                    </div>
                </div>
            </div>

            <div id="changelogTab" class="tab-content">
                <div class="content-panel">
                    <div class="content-box">
                        <div class="content-header">
                            原文 (CHANGELOG)
                            <button class="button" style="float: right; padding: 5px 10px; font-size: 12px;" onclick="translateContent('changelog')">翻译</button>
                        </div>
                        <div class="content-body">
                            <pre id="changelogOriginal">暂无内容</pre>
                        </div>
                    </div>
                    <div class="content-box">
                        <div class="content-header">
                            译文 (CHANGELOG)
                            <button class="button secondary" style="float: right; padding: 5px 10px; font-size: 12px;" onclick="saveTranslation('changelog')">保存</button>
                        </div>
                        <div class="content-body">
                            <pre id="changelogTranslated">点击"翻译"按钮开始翻译</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentExtensionId = '';
        let extensionDocs = {};

        // 加载扩展
        function loadExtension() {
            const input = document.getElementById('extensionInput').value.trim();
            if (!input) {
                showError('请输入扩展ID或Marketplace URL');
                return;
            }

            // 如果输入的是URL，提取扩展ID
            let extensionId = input;
            if (input.includes('marketplace.visualstudio.com')) {
                const match = input.match(/itemName=([^&]+)/);
                if (match) {
                    extensionId = match[1];
                } else {
                    showError('无法从URL中提取扩展ID');
                    return;
                }
            }

            vscode.postMessage({
                command: 'loadExtension',
                extensionId: extensionId
            });
        }

        // 显示已安装扩展
        function showInstalledExtensions() {
            const list = document.getElementById('installedExtensions');
            if (list.style.display === 'none') {
                vscode.postMessage({ command: 'listInstalledExtensions' });
                list.style.display = 'block';
            } else {
                list.style.display = 'none';
            }
        }

        // 切换标签页
        function switchTab(tabName) {
            // 更新标签按钮状态
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');

            // 更新标签内容
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tabName + 'Tab').classList.add('active');
        }

        // 翻译内容
        function translateContent(type) {
            const content = extensionDocs[type];
            if (!content) {
                showError(\`没有找到\${type.toUpperCase()}内容\`);
                return;
            }

            vscode.postMessage({
                command: 'translateContent',
                content: content,
                type: type
            });
        }

        // 保存翻译
        function saveTranslation(type) {
            const translatedElement = document.getElementById(type + 'Translated');
            const content = translatedElement.textContent;

            if (!content || content === '点击"翻译"按钮开始翻译') {
                showError('没有翻译内容可保存');
                return;
            }

            vscode.postMessage({
                command: 'saveTranslation',
                content: content,
                type: type,
                extensionId: currentExtensionId
            });
        }

        // 显示错误消息
        function showError(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = \`<div class="error">\${message}</div>\`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }

        // 显示成功消息
        function showSuccess(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = \`<div class="success">\${message}</div>\`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        }

        // 显示加载状态
        function showLoading(message) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = \`<div class="loading">\${message}</div>\`;
        }

        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'setInitialExtension':
                    document.getElementById('extensionInput').value = message.extensionId;
                    break;

                case 'showLoading':
                    showLoading(message.message);
                    break;

                case 'showError':
                    showError(message.message);
                    break;

                case 'extensionLoaded':
                    handleExtensionLoaded(message.extensionInfo, message.docs);
                    break;

                case 'installedExtensionsLoaded':
                    handleInstalledExtensionsLoaded(message.extensions);
                    break;

                case 'translationStarted':
                    handleTranslationStarted(message.type, message.message);
                    break;

                case 'translationProgress':
                    handleTranslationProgress(message.type, message.message);
                    break;

                case 'translationCompleted':
                    handleTranslationCompleted(message.type, message.translatedContent);
                    break;

                case 'translationError':
                    showError(message.message);
                    break;

                case 'saveCompleted':
                    showSuccess(\`\${message.type.toUpperCase()}翻译已保存到: \${message.filePath}\`);
                    break;
            }
        });

        function handleExtensionLoaded(extensionInfo, docs) {
            document.getElementById('statusMessage').innerHTML = '';

            currentExtensionId = extensionInfo.id;
            extensionDocs = docs;

            // 显示扩展信息
            document.getElementById('extensionTitle').textContent = extensionInfo.displayName;
            document.getElementById('extensionDescription').textContent = extensionInfo.description;
            document.getElementById('extensionVersion').textContent = extensionInfo.version;
            document.getElementById('extensionPublisher').textContent = extensionInfo.publisher;
            document.getElementById('extensionInfo').classList.add('visible');

            // 显示文档内容
            document.getElementById('readmeOriginal').textContent = docs.readme || '没有README文件';
            document.getElementById('changelogOriginal').textContent = docs.changelog || '没有CHANGELOG文件';

            // 清空之前的翻译
            document.getElementById('readmeTranslated').textContent = '点击"翻译"按钮开始翻译';
            document.getElementById('changelogTranslated').textContent = '点击"翻译"按钮开始翻译';

            document.getElementById('translationSection').classList.add('visible');
        }

        function handleInstalledExtensionsLoaded(extensions) {
            const list = document.getElementById('installedExtensions');
            list.innerHTML = '';

            extensions.forEach(ext => {
                const item = document.createElement('div');
                item.className = 'extension-item';
                item.innerHTML = \`
                    <h4>\${ext.displayName}</h4>
                    <p>\${ext.id} - \${ext.description}</p>
                \`;
                item.onclick = () => {
                    document.getElementById('extensionInput').value = ext.id;
                    list.style.display = 'none';
                    loadExtension();
                };
                list.appendChild(item);
            });
        }

        function handleTranslationStarted(type, message) {
            const translatedElement = document.getElementById(type + 'Translated');
            translatedElement.textContent = message;
        }

        function handleTranslationProgress(type, message) {
            const translatedElement = document.getElementById(type + 'Translated');
            translatedElement.textContent = message;
        }

        function handleTranslationCompleted(type, translatedContent) {
            const translatedElement = document.getElementById(type + 'Translated');
            translatedElement.textContent = translatedContent;
            showSuccess(\`\${type.toUpperCase()}翻译完成!\`);
        }

        // 按Enter键加载扩展
        document.getElementById('extensionInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadExtension();
            }
        });
    </script>
</body>
</html>`;
  }
}