import * as vscode from 'vscode';
import { getSecretStorageManager } from './extension';

export class SettingsWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {}

  show() {
    if (this.panel) {
      // 如果面板已存在，则显示它
      this.panel.reveal();
      return;
    }

    // 创建新的webview面板
    this.panel = vscode.window.createWebviewPanel(
      'mdTranslatorSettings',
      'Markdown Translator 设置',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    // 设置HTML内容
    this.panel.webview.html = this.getWebviewContent();

    // 处理来自webview的消息
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'saveSettings':
            this.saveSettings(message.settings);
            break;
          case 'testConnection':
            this.testConnection(message.engine);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    // 当面板被关闭时清理
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );

    // 加载当前设置
    this.loadCurrentSettings();
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Translator 设置</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
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
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
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
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .status-message {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        .status-success {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .status-error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .engine-config {
            display: none;
            margin-top: 15px;
            padding: 15px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
        }
        .engine-config.active {
            display: block;
        }
        .engine-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Markdown Translator 设置</h1>

        <div class="section">
            <div class="section-title">翻译引擎配置</div>

            <div class="form-group">
                <label for="defaultEngine">默认翻译引擎</label>
                <select id="defaultEngine" onchange="showEngineConfig()">
                    <option value="google">Google Translate</option>
                    <option value="microsoft">Microsoft Translator</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai-compatible">OpenAI Compatible API</option>
                    <option value="zhipu">Zhipu AI</option>
                    <option value="xai">xAI Grok</option>
                    <option value="ollama">Ollama</option>
                    <option value="lm-studio">LM Studio</option>
                </select>
            </div>

            <!-- Google Translate 配置 -->
            <div id="engine-google" class="engine-config">
                <div class="engine-title">Google Translate 配置</div>
                <div class="form-group">
                    <label for="googleApiKey">API 密钥</label>
                    <input type="password" id="googleApiKey" placeholder="输入 Google Cloud Translation API 密钥">
                    <div class="description">需要在 Google Cloud Console 启用 Translation API</div>
                </div>
            </div>

            <!-- Microsoft Translator 配置 -->
            <div id="engine-microsoft" class="engine-config">
                <div class="engine-title">Microsoft Translator 配置</div>
                <div class="form-group">
                    <label for="microsoftApiKey">API 密钥</label>
                    <input type="password" id="microsoftApiKey" placeholder="输入 Microsoft Translator API 密钥">
                </div>
                <div class="form-group">
                    <label for="microsoftRegion">服务区域</label>
                    <input type="text" id="microsoftRegion" placeholder="global" value="global">
                    <div class="description">如果使用多服务资源，请指定区域</div>
                </div>
            </div>

            <!-- OpenAI 配置 -->
            <div id="engine-openai" class="engine-config">
                <div class="engine-title">OpenAI GPT 配置</div>
                <div class="form-group">
                    <label for="openaiApiKey">API 密钥</label>
                    <input type="password" id="openaiApiKey" placeholder="输入 OpenAI API 密钥">
                </div>
                <div class="form-group">
                    <label for="openaiModel">模型</label>
                    <input type="text" id="openaiModel" placeholder="gpt-5" value="gpt-5">
                    <div class="description">推荐：gpt-5, gpt-4o-mini, gpt-4o, gpt-4.1</div>
                </div>
            </div>

            <!-- Claude 配置 -->
            <div id="engine-claude" class="engine-config">
                <div class="engine-title">Anthropic Claude 配置</div>
                <div class="form-group">
                    <label for="claudeApiKey">API 密钥</label>
                    <input type="password" id="claudeApiKey" placeholder="输入 Claude API 密钥">
                </div>
                <div class="form-group">
                    <label for="claudeBaseUrl">Base URL</label>
                    <input type="text" id="claudeBaseUrl" placeholder="https://api.anthropic.com" value="https://api.anthropic.com">
                    <div class="description">Claude API 的基础 URL，支持自定义代理或第三方兼容服务</div>
                </div>
                <div class="form-group">
                    <label for="claudeModel">模型</label>
                    <input type="text" id="claudeModel" placeholder="claude-sonnet-4-20250514" value="claude-sonnet-4-20250514">
                    <div class="description">推荐：claude-opus-4-1-20250805, claude-sonnet-4-20250514, claude-3-7-sonnet-20250219</div>
                </div>
            </div>

            <!-- Gemini 配置 -->
            <div id="engine-gemini" class="engine-config">
                <div class="engine-title">Google Gemini 配置</div>
                <div class="form-group">
                    <label for="geminiApiKey">API 密钥</label>
                    <input type="password" id="geminiApiKey" placeholder="输入 Gemini API 密钥">
                    <div class="description">可在 Google AI Studio 获取密钥</div>
                </div>
                <div class="form-group">
                    <label for="geminiModel">模型</label>
                    <input type="text" id="geminiModel" placeholder="gemini-2.5-flash" value="gemini-2.5-flash">
                    <div class="description">推荐：gemini-2.5-pro, gemini-2.5-flash</div>
                </div>
            </div>

            <!-- Zhipu 配置 -->
            <div id="engine-zhipu" class="engine-config">
                <div class="engine-title">Zhipu AI 配置</div>
                <div class="form-group">
                    <label for="zhipuApiKey">API 密钥</label>
                    <input type="password" id="zhipuApiKey" placeholder="输入 Zhipu API 密钥">
                    <div class="description">可在智谱开放平台获取密钥</div>
                </div>
                <div class="form-group">
                    <label for="zhipuModel">模型</label>
                    <input type="text" id="zhipuModel" placeholder="glm-4-flash" value="glm-4-flash">
                    <div class="description">推荐：glm-4-flash、glm-4-plus 等</div>
                </div>
            </div>

            <!-- xAI 配置 -->
            <div id="engine-xai" class="engine-config">
                <div class="engine-title">xAI Grok 配置</div>
                <div class="form-group">
                    <label for="xaiApiKey">API 密钥</label>
                    <input type="password" id="xaiApiKey" placeholder="输入 xAI API 密钥">
                    <div class="description">可在 x.ai 平台获取密钥</div>
                </div>
                <div class="form-group">
                    <label for="xaiModel">模型</label>
                    <input type="text" id="xaiModel" placeholder="grok-4-0709" value="grok-4-0709">
                    <div class="description">推荐：grok-4-0709, grok-4, grok-code-fast-1 等</div>
                </div>
            </div>

            <!-- OpenAI Compatible 配置 -->
            <div id="engine-openai-compatible" class="engine-config">
                <div class="engine-title">OpenAI Compatible API 配置</div>
                <div class="form-group">
                    <label for="openaiCompatibleBaseUrl">基础 URL</label>
                    <input type="text" id="openaiCompatibleBaseUrl" placeholder="https://api.example.com">
                    <div class="description">兼容 OpenAI API 格式的服务地址</div>
                </div>
                <div class="form-group">
                    <label for="openaiCompatibleApiKey">API 密钥</label>
                    <input type="password" id="openaiCompatibleApiKey" placeholder="输入 API 密钥">
                </div>
                <div class="form-group">
                    <label for="openaiCompatibleModel">模型</label>
                    <input type="text" id="openaiCompatibleModel" placeholder="gpt-4o-mini">
                </div>
            </div>

            <!-- Ollama 配置 -->
            <div id="engine-ollama" class="engine-config">
                <div class="engine-title">Ollama 配置</div>
                <div class="form-group">
                    <label for="ollamaBaseUrl">服务地址</label>
                    <input type="text" id="ollamaBaseUrl" placeholder="http://localhost:11434" value="http://localhost:11434">
                </div>
                <div class="form-group">
                    <label for="ollamaModel">模型</label>
                    <input type="text" id="ollamaModel" placeholder="local-model">
                    <div class="description">确保模型已在 Ollama 中下载</div>
                </div>
            </div>

            <!-- LM Studio 配置 -->
            <div id="engine-lm-studio" class="engine-config">
                <div class="engine-title">LM Studio 配置</div>
                <div class="form-group">
                    <label for="lmStudioBaseUrl">服务地址</label>
                    <input type="text" id="lmStudioBaseUrl" placeholder="http://localhost:1234" value="http://localhost:1234">
                </div>
                <div class="form-group">
                    <label for="lmStudioModel">模型</label>
                    <input type="text" id="lmStudioModel" placeholder="local-model">
                    <div class="description">确保 LM Studio 服务器正在运行</div>
                </div>
            </div>

            <button class="button secondary" onclick="testConnection()">测试连接</button>
            <div id="testStatus" class="status-message"></div>
        </div>

        <div class="section">
            <div class="section-title">翻译设置</div>

            <div class="form-group">
                <label for="targetLanguage">默认目标语言</label>
                <select id="targetLanguage">
                    <option value="zh-CN">中文（简体）</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="ru">Русский</option>
                </select>
            </div>

            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="createNewFile">
                    <label for="createNewFile">翻译后创建新文件</label>
                </div>
                <div class="description">勾选后会创建新文件，否则直接替换原文件内容</div>
            </div>

                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="longContextOptimization">
                        <label for="longContextOptimization">启用长上下文优化</label>
                    </div>
                    <div class="description">将长文档按批次翻译，减少超时或上下文截断问题</div>
                </div>

                <div class="form-group">
                    <label for="longContextChunkSize">批次长度限制 (字符)</label>
                    <input type="number" id="longContextChunkSize" min="500" max="20000" step="500" value="5000">
                    <div class="description">每批翻译的最大字符数，数值越大批次数越少但更容易超时</div>
                </div>
        </div>

        <div class="section">
            <button class="button" onclick="saveSettings()">保存设置</button>
            <button class="button secondary" onclick="resetSettings()">重置为默认值</button>
            <div id="saveStatus" class="status-message"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function showEngineConfig() {
            const selectedEngine = document.getElementById('defaultEngine').value;

            // 隐藏所有引擎配置
            const configs = document.querySelectorAll('.engine-config');
            configs.forEach(config => config.classList.remove('active'));

            // 显示选中的引擎配置
            const selectedConfig = document.getElementById('engine-' + selectedEngine);
            if (selectedConfig) {
                selectedConfig.classList.add('active');
            }
        }

        function saveSettings() {
            const engine = document.getElementById('defaultEngine').value;
            const settings = {
                defaultEngine: engine,
                targetLanguage: document.getElementById('targetLanguage').value,
                createNewFile: document.getElementById('createNewFile').checked,
                longContextOptimization: document.getElementById('longContextOptimization').checked,
                longContextChunkSize: Number(document.getElementById('longContextChunkSize').value) || 5000,

                // 各引擎配置
                googleApiKey: document.getElementById('googleApiKey').value,
                microsoftApiKey: document.getElementById('microsoftApiKey').value,
                microsoftRegion: document.getElementById('microsoftRegion').value,
                openaiApiKey: document.getElementById('openaiApiKey').value,
                openaiModel: document.getElementById('openaiModel').value,
                claudeApiKey: document.getElementById('claudeApiKey').value,
                claudeBaseUrl: document.getElementById('claudeBaseUrl').value,
                claudeModel: document.getElementById('claudeModel').value,
                geminiApiKey: document.getElementById('geminiApiKey').value,
                geminiModel: document.getElementById('geminiModel').value,
                openaiCompatibleApiKey: document.getElementById('openaiCompatibleApiKey').value,
                openaiCompatibleBaseUrl: document.getElementById('openaiCompatibleBaseUrl').value,
                openaiCompatibleModel: document.getElementById('openaiCompatibleModel').value,
                zhipuApiKey: document.getElementById('zhipuApiKey').value,
                zhipuModel: document.getElementById('zhipuModel').value,
                xaiApiKey: document.getElementById('xaiApiKey').value,
                xaiModel: document.getElementById('xaiModel').value,
                ollamaBaseUrl: document.getElementById('ollamaBaseUrl').value,
                ollamaModel: document.getElementById('ollamaModel').value,
                lmStudioBaseUrl: document.getElementById('lmStudioBaseUrl').value,
                lmStudioModel: document.getElementById('lmStudioModel').value
            };

            vscode.postMessage({
                command: 'saveSettings',
                settings: settings
            });
        }

        function testConnection() {
            const engine = document.getElementById('defaultEngine').value;
            showTestStatus('正在测试连接...', 'info');

            vscode.postMessage({
                command: 'testConnection',
                engine: engine
            });
        }

        function resetSettings() {
            document.getElementById('defaultEngine').value = 'google';
            document.getElementById('targetLanguage').value = 'zh-CN';
            document.getElementById('createNewFile').checked = true;
            document.getElementById('longContextOptimization').checked = false;
            document.getElementById('longContextChunkSize').value = '5000';

            // 重置所有API配置
            document.getElementById('googleApiKey').value = '';
            document.getElementById('microsoftApiKey').value = '';
            document.getElementById('microsoftRegion').value = 'global';
            document.getElementById('openaiApiKey').value = '';
            document.getElementById('openaiModel').value = 'gpt-5';
            document.getElementById('claudeApiKey').value = '';
            document.getElementById('claudeBaseUrl').value = 'https://api.anthropic.com';
            document.getElementById('claudeModel').value = 'claude-sonnet-4-20250514';
            document.getElementById('geminiApiKey').value = '';
            document.getElementById('geminiModel').value = 'gemini-2.5-flash';
            document.getElementById('openaiCompatibleApiKey').value = '';
            document.getElementById('openaiCompatibleBaseUrl').value = '';
            document.getElementById('openaiCompatibleModel').value = 'gpt-4o-mini';
            document.getElementById('xaiApiKey').value = '';
            document.getElementById('xaiModel').value = 'grok-4-0709';
            document.getElementById('ollamaBaseUrl').value = 'http://localhost:11434';
            document.getElementById('ollamaModel').value = '';
            document.getElementById('lmStudioBaseUrl').value = 'http://localhost:1234';
            document.getElementById('lmStudioModel').value = '';

            showEngineConfig();
        }

        function showSaveStatus(message, type) {
            const statusDiv = document.getElementById('saveStatus');
            statusDiv.textContent = message;
            statusDiv.className = 'status-message status-' + type;
            statusDiv.style.display = 'block';

            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }

        function showTestStatus(message, type) {
            const statusDiv = document.getElementById('testStatus');
            statusDiv.textContent = message;
            statusDiv.className = 'status-message status-' + type;
            statusDiv.style.display = 'block';

            if (type !== 'info') {
                setTimeout(() => {
                    statusDiv.style.display = 'none';
                }, 3000);
            }
        }

        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'loadSettings':
                    const settings = message.settings;
                    document.getElementById('defaultEngine').value = settings.defaultEngine || 'google';
                    document.getElementById('targetLanguage').value = settings.targetLanguage || 'zh-CN';
                    document.getElementById('createNewFile').checked = settings.createNewFile !== false;

                    // 加载各引擎配置
                    document.getElementById('googleApiKey').value = settings.googleApiKey || '';
                    document.getElementById('microsoftApiKey').value = settings.microsoftApiKey || '';
                    document.getElementById('microsoftRegion').value = settings.microsoftRegion || 'global';
                    document.getElementById('openaiApiKey').value = settings.openaiApiKey || '';
                    document.getElementById('openaiModel').value = settings.openaiModel || 'gpt-5';
                    document.getElementById('claudeApiKey').value = settings.claudeApiKey || '';
                    document.getElementById('claudeBaseUrl').value = settings.claudeBaseUrl || 'https://api.anthropic.com';
                    document.getElementById('claudeModel').value = settings.claudeModel || 'claude-sonnet-4-20250514';
                    document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
                    document.getElementById('geminiModel').value = settings.geminiModel || 'gemini-2.5-flash';
                    document.getElementById('openaiCompatibleApiKey').value = settings.openaiCompatibleApiKey || '';
                    document.getElementById('openaiCompatibleBaseUrl').value = settings.openaiCompatibleBaseUrl || '';
                    document.getElementById('openaiCompatibleModel').value = settings.openaiCompatibleModel || 'gpt-4o-mini';
                    document.getElementById('xaiApiKey').value = settings.xaiApiKey || '';
                    document.getElementById('xaiModel').value = settings.xaiModel || 'grok-4-0709';
                    document.getElementById('ollamaBaseUrl').value = settings.ollamaBaseUrl || 'http://localhost:11434';
                    document.getElementById('ollamaModel').value = settings.ollamaModel || '';
                    document.getElementById('lmStudioBaseUrl').value = settings.lmStudioBaseUrl || 'http://localhost:1234';
                    document.getElementById('lmStudioModel').value = settings.lmStudioModel || '';
                    document.getElementById('longContextOptimization').checked = settings.longContextOptimization || false;
                    document.getElementById('longContextChunkSize').value = settings.longContextChunkSize || 5000;

                    showEngineConfig();
                    break;

                case 'saveResult':
                    showSaveStatus(message.success ? '设置已保存' : '保存失败: ' + message.error,
                                 message.success ? 'success' : 'error');
                    break;

                case 'testResult':
                    const testMessage = message.success
                        ? '连接测试成功'
                        : '连接失败: ' + (message.error || '未知错误');
                    showTestStatus(testMessage, message.success ? 'success' : 'error');
                    break;
            }
        });

        // 初始化显示
        document.addEventListener('DOMContentLoaded', function() {
            showEngineConfig();
        });
    </script>
</body>
</html>`;
  }

  private async loadCurrentSettings() {
    if (!this.panel) {
      return;
    }

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const secretStorage = getSecretStorageManager();

    // 从安全存储加载API keys
    const settings = {
      defaultEngine: config.get<string>('defaultEngine', 'google'),
      targetLanguage: config.get<string>('targetLanguage', 'zh-CN'),
      createNewFile: config.get<boolean>('createNewFile', true),

      // 从安全存储加载各引擎配置
      googleApiKey: (await secretStorage.getApiKeyWithFallback('google')) || '',
      microsoftApiKey: (await secretStorage.getApiKeyWithFallback('microsoft')) || '',
      microsoftRegion: config.get<string>('microsoftRegion', 'global'),
      openaiApiKey: (await secretStorage.getApiKeyWithFallback('openai')) || '',
      openaiModel: config.get<string>('openaiModel', 'gpt-5'),
      claudeApiKey: (await secretStorage.getApiKeyWithFallback('claude')) || '',
      claudeBaseUrl: config.get<string>('claudeBaseUrl', 'https://api.anthropic.com'),
      claudeModel: config.get<string>('claudeModel', 'claude-sonnet-4-20250514'),
      geminiApiKey: (await secretStorage.getApiKeyWithFallback('gemini')) || '',
      geminiModel: config.get<string>('geminiModel', 'gemini-2.5-flash'),
      openaiCompatibleApiKey: (await secretStorage.getApiKeyWithFallback('openaiCompatible')) || '',
      openaiCompatibleBaseUrl: config.get<string>('openaiCompatibleBaseUrl', ''),
      openaiCompatibleModel: config.get<string>('openaiCompatibleModel', 'gpt-4o-mini'),
      zhipuApiKey: (await secretStorage.getApiKeyWithFallback('zhipu')) || '',
      zhipuModel: config.get<string>('zhipuModel', 'glm-4-flash'),
      xaiApiKey: (await secretStorage.getApiKeyWithFallback('xai')) || '',
      xaiModel: config.get<string>('xaiModel', 'grok-4-0709'),
      ollamaBaseUrl: config.get<string>('ollamaBaseUrl', 'http://localhost:11434'),
      ollamaModel: config.get<string>('ollamaModel', ''),
      lmStudioBaseUrl: config.get<string>('lmStudioBaseUrl', 'http://localhost:1234'),
      lmStudioModel: config.get<string>('lmStudioModel', ''),
      longContextOptimization: config.get<boolean>('longContextOptimization', false),
      longContextChunkSize: config.get<number>('longContextChunkSize', 5000)
    };

    this.panel.webview.postMessage({
      command: 'loadSettings',
      settings: settings
    });
  }

  private async saveSettings(settings: any) {
    try {
      const config = vscode.workspace.getConfiguration('mdTranslator');
      const secretStorage = getSecretStorageManager();

      // 保存基本设置到配置
      await config.update('defaultEngine', settings.defaultEngine, vscode.ConfigurationTarget.Workspace);
      await config.update('targetLanguage', settings.targetLanguage, vscode.ConfigurationTarget.Workspace);
      await config.update('createNewFile', settings.createNewFile, vscode.ConfigurationTarget.Workspace);
      await config.update('longContextOptimization', settings.longContextOptimization, vscode.ConfigurationTarget.Workspace);
      await config.update('longContextChunkSize', settings.longContextChunkSize, vscode.ConfigurationTarget.Workspace);

      // 保存非敏感配置
      await config.update('microsoftRegion', settings.microsoftRegion, vscode.ConfigurationTarget.Workspace);
      await config.update('openaiModel', settings.openaiModel, vscode.ConfigurationTarget.Workspace);
      await config.update('claudeBaseUrl', settings.claudeBaseUrl, vscode.ConfigurationTarget.Workspace);
      await config.update('claudeModel', settings.claudeModel, vscode.ConfigurationTarget.Workspace);
      await config.update('geminiModel', settings.geminiModel, vscode.ConfigurationTarget.Workspace);
      await config.update('openaiCompatibleBaseUrl', settings.openaiCompatibleBaseUrl, vscode.ConfigurationTarget.Workspace);
      await config.update('openaiCompatibleModel', settings.openaiCompatibleModel, vscode.ConfigurationTarget.Workspace);
      await config.update('zhipuModel', settings.zhipuModel, vscode.ConfigurationTarget.Workspace);
      await config.update('xaiModel', settings.xaiModel, vscode.ConfigurationTarget.Workspace);
      await config.update('ollamaBaseUrl', settings.ollamaBaseUrl, vscode.ConfigurationTarget.Workspace);
      await config.update('ollamaModel', settings.ollamaModel, vscode.ConfigurationTarget.Workspace);
      await config.update('lmStudioBaseUrl', settings.lmStudioBaseUrl, vscode.ConfigurationTarget.Workspace);
      await config.update('lmStudioModel', settings.lmStudioModel, vscode.ConfigurationTarget.Workspace);

      // 保存API keys到插件目录（为空则删除）
      await secretStorage.storeApiKey('google', settings.googleApiKey);
      await secretStorage.storeApiKey('microsoft', settings.microsoftApiKey);
      await secretStorage.storeApiKey('openai', settings.openaiApiKey);
      await secretStorage.storeApiKey('claude', settings.claudeApiKey);
      await secretStorage.storeApiKey('gemini', settings.geminiApiKey);
      await secretStorage.storeApiKey('openaiCompatible', settings.openaiCompatibleApiKey);
      await secretStorage.storeApiKey('zhipu', settings.zhipuApiKey);
      await secretStorage.storeApiKey('xai', settings.xaiApiKey);

      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'saveResult',
          success: true
        });
      }

      vscode.window.showInformationMessage('设置已保存');
    } catch (error) {
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'saveResult',
          success: false,
          error: String(error)
        });
      }

      vscode.window.showErrorMessage('保存设置失败: ' + String(error));
    }
  }

  private async testConnection(engine: string) {
    try {
      const { TranslationEngineManager } = await import('./engines/engineManager');
      const engineManager = new TranslationEngineManager();

      const isValid = await engineManager.validateEngine(engine as any);

      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'testResult',
          success: isValid,
          error: isValid ? undefined : '连接验证失败，请检查配置是否正确'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'testResult',
          success: false,
          error: errorMessage
        });
      }
    }
  }
}