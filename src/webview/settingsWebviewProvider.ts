import * as vscode from 'vscode';
import * as path from 'path';
import { TranslatorService } from '../services/translatorService';

/**
 * 配置页面WebView提供者
 */
export class SettingsWebviewProvider {
    private panel?: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private translatorService: TranslatorService;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.translatorService = new TranslatorService();
    }

    /**
     * 显示配置页面
     */
    public show(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.createPanel();
        }
    }

    /**
     * 创建WebView面板
     */
    private createPanel(): void {
        this.panel = vscode.window.createWebviewPanel(
            'markdownTranslatorSettings',
            'Markdown Translator 配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'src'))
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        // 处理来自WebView的消息
        this.panel.webview.onDidReceiveMessage(
            this.handleMessage.bind(this),
            undefined,
            this.context.subscriptions
        );

        // 面板关闭时清理
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            undefined,
            this.context.subscriptions
        );

        // 加载当前配置
        this.loadCurrentSettings();
    }

    /**
     * 处理来自WebView的消息
     */
    private async handleMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'saveSettings':
                await this.saveSettings(message.settings);
                break;
            case 'loadSettings':
                await this.loadCurrentSettings();
                break;
            case 'testTranslation':
                await this.testTranslation(message.engine, message.text, message.targetLang);
                break;
        }
    }

    /**
     * 保存配置
     */
    private async saveSettings(settings: any): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('markdownTranslator');

            await config.update('defaultEngine', settings.defaultEngine, vscode.ConfigurationTarget.Global);
            await config.update('defaultTargetLanguage', settings.defaultTargetLanguage, vscode.ConfigurationTarget.Global);
            await config.update('createCopyFile', settings.createCopyFile, vscode.ConfigurationTarget.Global);
            await config.update('autoTranslateOnOpen', settings.autoTranslateOnOpen, vscode.ConfigurationTarget.Global);

            // 保存各引擎的API密钥和配置
            if (settings.openaiApiKey) {
                await config.update('openaiApiKey', settings.openaiApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.openaiModel) {
                await config.update('openaiModel', settings.openaiModel, vscode.ConfigurationTarget.Global);
            }
            if (settings.claudeApiKey) {
                await config.update('claudeApiKey', settings.claudeApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.claudeModel) {
                await config.update('claudeModel', settings.claudeModel, vscode.ConfigurationTarget.Global);
            }
            if (settings.baiduAppId) {
                await config.update('baiduAppId', settings.baiduAppId, vscode.ConfigurationTarget.Global);
            }
            if (settings.baiduSecretKey) {
                await config.update('baiduSecretKey', settings.baiduSecretKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.microsoftApiKey) {
                await config.update('microsoftApiKey', settings.microsoftApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.microsoftRegion) {
                await config.update('microsoftRegion', settings.microsoftRegion, vscode.ConfigurationTarget.Global);
            }
            if (settings.siliconflowApiKey) {
                await config.update('siliconflowApiKey', settings.siliconflowApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.siliconflowModel) {
                await config.update('siliconflowModel', settings.siliconflowModel, vscode.ConfigurationTarget.Global);
            }
            if (settings.openaiCompatibleApiKey) {
                await config.update('openaiCompatibleApiKey', settings.openaiCompatibleApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.openaiCompatibleBaseUrl) {
                await config.update('openaiCompatibleBaseUrl', settings.openaiCompatibleBaseUrl, vscode.ConfigurationTarget.Global);
            }
            if (settings.openaiCompatibleModel) {
                await config.update('openaiCompatibleModel', settings.openaiCompatibleModel, vscode.ConfigurationTarget.Global);
            }
            if (settings.localLlmBaseUrl) {
                await config.update('localLlmBaseUrl', settings.localLlmBaseUrl, vscode.ConfigurationTarget.Global);
            }
            if (settings.localLlmModel) {
                await config.update('localLlmModel', settings.localLlmModel, vscode.ConfigurationTarget.Global);
            }
            if (settings.geminiApiKey) {
                await config.update('geminiApiKey', settings.geminiApiKey, vscode.ConfigurationTarget.Global);
            }
            if (settings.geminiModel) {
                await config.update('geminiModel', settings.geminiModel, vscode.ConfigurationTarget.Global);
            }

            this.panel?.webview.postMessage({
                command: 'settingsSaved',
                success: true
            });

            vscode.window.showInformationMessage('配置已保存');
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'settingsSaved',
                success: false,
                error: error
            });

            vscode.window.showErrorMessage(`保存配置失败: ${error}`);
        }
    }

    /**
     * 加载当前配置
     */
    private async loadCurrentSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('markdownTranslator');

        const settings = {
            defaultEngine: config.get('defaultEngine', 'google'),
            defaultTargetLanguage: config.get('defaultTargetLanguage', 'auto'),
            createCopyFile: config.get('createCopyFile', true),
            autoTranslateOnOpen: config.get('autoTranslateOnOpen', false),
            openaiApiKey: config.get('openaiApiKey', ''),
            openaiModel: config.get('openaiModel', 'gpt-5'),
            claudeApiKey: config.get('claudeApiKey', ''),
            claudeModel: config.get('claudeModel', 'claude-sonnet-4-20250514'),
            baiduAppId: config.get('baiduAppId', ''),
            baiduSecretKey: config.get('baiduSecretKey', ''),
            microsoftApiKey: config.get('microsoftApiKey', ''),
            microsoftRegion: config.get('microsoftRegion', 'global'),
            siliconflowApiKey: config.get('siliconflowApiKey', ''),
            siliconflowModel: config.get('siliconflowModel', 'Qwen/Qwen2.5-7B-Instruct'),
            openaiCompatibleApiKey: config.get('openaiCompatibleApiKey', ''),
            openaiCompatibleBaseUrl: config.get('openaiCompatibleBaseUrl', ''),
            openaiCompatibleModel: config.get('openaiCompatibleModel', ''),
            localLlmBaseUrl: config.get('localLlmBaseUrl', 'http://localhost:11434'),
            localLlmModel: config.get('localLlmModel', 'qwen2.5:latest'),
            geminiApiKey: config.get('geminiApiKey', ''),
            geminiModel: config.get('geminiModel', 'gemini-2.5-flash')
        };

        this.panel?.webview.postMessage({
            command: 'settingsLoaded',
            settings: settings
        });
    }

    /**
     * 测试翻译功能
     */
    private async testTranslation(engine: string, text: string, targetLang: string): Promise<void> {
        try {
            // 临时保存当前配置
            const currentConfig = vscode.workspace.getConfiguration('markdownTranslator');
            const originalEngine = currentConfig.get('defaultEngine');

            // 临时更新引擎配置进行测试
            await currentConfig.update('defaultEngine', engine, vscode.ConfigurationTarget.Global);

            // 更新翻译服务配置
            this.translatorService.updateConfiguration();

            // 执行翻译测试
            const result = await this.translatorService.translate(text, targetLang);

            // 恢复原配置
            await currentConfig.update('defaultEngine', originalEngine, vscode.ConfigurationTarget.Global);
            this.translatorService.updateConfiguration();

            this.panel?.webview.postMessage({
                command: 'testResult',
                success: true,
                result: result
            });
        } catch (error) {
            this.panel?.webview.postMessage({
                command: 'testResult',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * 获取WebView的HTML内容
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>Markdown Translator 配置</title>
    <style>
        :root {
            --vscode-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 10px;
            margin-bottom: 30px;
        }

        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            background-color: var(--vscode-editor-background);
        }

        .section h2 {
            margin-top: 0;
            color: var(--vscode-foreground);
            font-size: 1.2em;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        input[type="text"],
        input[type="password"],
        select,
        textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: 14px;
            box-sizing: border-box;
        }

        input[type="text"]:focus,
        input[type="password"]:focus,
        select:focus,
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        input[type="checkbox"] {
            margin-right: 8px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .checkbox-group label {
            margin-bottom: 0;
            margin-left: 5px;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 14px;
            margin-right: 10px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .button-group {
            margin-top: 20px;
            text-align: right;
        }

        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }

        .test-section {
            background-color: var(--vscode-editor-selectionBackground);
            padding: 15px;
            border-radius: 4px;
            margin-top: 15px;
        }

        .test-result {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
        }

        .error {
            color: var(--vscode-errorForeground);
        }

        .success {
            color: var(--vscode-terminal-ansiGreen);
        }

        .api-key-input {
            font-family: monospace !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌍 Markdown Translator 配置</h1>

        <!-- 基础设置 -->
        <div class="section">
            <h2>基础设置</h2>

            <div class="form-group">
                <label for="defaultEngine">默认翻译引擎</label>
                <select id="defaultEngine">
                    <option value="google">Google 翻译 (免费)</option>
                    <option value="baidu">百度翻译</option>
                    <option value="microsoft">微软翻译</option>
                    <option value="siliconflow">硅基流动翻译</option>
                    <option value="openai">OpenAI</option>
                    <option value="openai-compatible">OpenAI Compatible</option>
                    <option value="local-llm">本地LLM (Ollama/LM Studio)</option>
                    <option value="claude">Claude</option>
                    <option value="gemini">Google Gemini</option>
                </select>
                <div class="description">选择默认使用的翻译引擎</div>
            </div>

            <div class="form-group">
                <label for="defaultTargetLanguage">默认目标语言</label>
                <select id="defaultTargetLanguage">
                    <option value="auto">自动检测</option>
                    <option value="zh-CN">中文</option>
                    <option value="en">英文</option>
                    <option value="ja">日文</option>
                    <option value="ko">韩文</option>
                    <option value="fr">法文</option>
                    <option value="de">德文</option>
                    <option value="es">西班牙文</option>
                    <option value="ru">俄文</option>
                </select>
                <div class="description">自动检测会根据文档内容智能选择目标语言</div>
            </div>

            <div class="checkbox-group">
                <input type="checkbox" id="createCopyFile">
                <label for="createCopyFile">创建副本文件而不是修改原文件</label>
            </div>
            <div class="description">启用后会生成 README.zh-CN.md 或 filename-copy.md</div>

            <div class="checkbox-group">
                <input type="checkbox" id="autoTranslateOnOpen">
                <label for="autoTranslateOnOpen">打开 Markdown 文件时自动翻译</label>
            </div>
        </div>

        <!-- OpenAI 配置 -->
        <div class="section">
            <h2>OpenAI 配置</h2>

            <div class="form-group">
                <label for="openaiApiKey">API 密钥</label>
                <input type="password" id="openaiApiKey" class="api-key-input" placeholder="sk-...">
                <div class="description">从 https://platform.openai.com/api-keys 获取</div>
            </div>

            <div class="form-group">
                <label for="openaiModel">模型</label>
                <input type="text" id="openaiModel" placeholder="gpt-5, gpt-5-chat...">
                <div class="description">输入您要使用的OpenAI模型名称</div>
            </div>
        </div>

        <!-- Claude 配置 -->
        <div class="section">
            <h2>Claude 配置</h2>

            <div class="form-group">
                <label for="claudeApiKey">API 密钥</label>
                <input type="password" id="claudeApiKey" class="api-key-input" placeholder="sk-ant-...">
                <div class="description">从 https://console.anthropic.com/ 获取</div>
            </div>

            <div class="form-group">
                <label for="claudeModel">模型</label>
                <input type="text" id="claudeModel" placeholder="claude-3-7-sonnet-20250219, claude-sonnet-4-20250514...">
                <div class="description">输入您要使用的Claude模型名称</div>
            </div>
        </div>

        <!-- 百度翻译配置 -->
        <div class="section">
            <h2>百度翻译配置</h2>

            <div class="form-group">
                <label for="baiduAppId">APP ID</label>
                <input type="text" id="baiduAppId" placeholder="20231201001234567">
                <div class="description">从百度翻译开放平台获取</div>
            </div>

            <div class="form-group">
                <label for="baiduSecretKey">密钥</label>
                <input type="password" id="baiduSecretKey" class="api-key-input">
            </div>
        </div>

        <!-- 微软翻译配置 -->
        <div class="section">
            <h2>微软翻译配置</h2>

            <div class="form-group">
                <label for="microsoftApiKey">API 密钥</label>
                <input type="password" id="microsoftApiKey" class="api-key-input">
                <div class="description">从 Azure Translator 服务获取</div>
            </div>

            <div class="form-group">
                <label for="microsoftRegion">服务区域</label>
                <input type="text" id="microsoftRegion" placeholder="global, eastus, westus2...">
                <div class="description">Azure Translator 服务所在区域</div>
            </div>
        </div>

        <!-- 硅基流动配置 -->
        <div class="section">
            <h2>硅基流动配置</h2>

            <div class="form-group">
                <label for="siliconflowApiKey">API 密钥</label>
                <input type="password" id="siliconflowApiKey" class="api-key-input">
                <div class="description">从硅基流动平台获取</div>
            </div>

            <div class="form-group">
                <label for="siliconflowModel">模型</label>
                <input type="text" id="siliconflowModel" placeholder="qwen2.5-7b-Instruct, deepseek-v3.1...">
                <div class="description">输入您要使用的模型名称</div>
            </div>
        </div>

        <!-- OpenAI Compatible 配置 -->
        <div class="section">
            <h2>OpenAI Compatible 配置</h2>

            <div class="form-group">
                <label for="openaiCompatibleBaseUrl">API 基础URL</label>
                <input type="text" id="openaiCompatibleBaseUrl" placeholder="https://api.example.com/v1">
                <div class="description">兼容OpenAI接口的API服务地址</div>
            </div>

            <div class="form-group">
                <label for="openaiCompatibleApiKey">API 密钥</label>
                <input type="password" id="openaiCompatibleApiKey" class="api-key-input">
            </div>

            <div class="form-group">
                <label for="openaiCompatibleModel">模型</label>
                <input type="text" id="openaiCompatibleModel" placeholder="deepseek-chat">
                <div class="description">使用的模型名称</div>
            </div>
        </div>

        <!-- 本地LLM配置 -->
        <div class="section">
            <h2>本地LLM配置 (Ollama/LM Studio)</h2>

            <div class="form-group">
                <label for="localLlmBaseUrl">服务地址</label>
                <input type="text" id="localLlmBaseUrl" placeholder="http://localhost:11434">
                <div class="description">本地LLM服务的API地址</div>
            </div>

            <div class="form-group">
                <label for="localLlmModel">模型</label>
                <input type="text" id="localLlmModel" placeholder="qwen2.5-latest...">
                <div class="description">本地部署的模型名称</div>
            </div>
        </div>

        <!-- Gemini 配置 -->
        <div class="section">
            <h2>Google Gemini 配置</h2>

            <div class="form-group">
                <label for="geminiApiKey">API 密钥</label>
                <input type="password" id="geminiApiKey" class="api-key-input">
                <div class="description">从 Google AI Studio 获取</div>
            </div>

            <div class="form-group">
                <label for="geminiModel">模型</label>
                <input type="text" id="geminiModel" placeholder="gemini-2.5-flash...">
                <div class="description">输入您要使用的Gemini模型名称</div>
            </div>
        </div>

        <!-- 测试区域 -->
        <div class="section">
            <h2>测试翻译</h2>
            <div class="test-section">
                <div class="form-group">
                    <label for="testText">测试文本</label>
                    <textarea id="testText" rows="3" placeholder="输入要测试的文本...">Hello, World!</textarea>
                </div>

                <div class="form-group">
                    <label for="testTargetLang">目标语言</label>
                    <select id="testTargetLang">
                        <option value="zh">中文</option>
                        <option value="en">英文</option>
                        <option value="ja">日文</option>
                        <option value="ko">韩文</option>
                    </select>
                </div>

                <button onclick="testTranslation()">测试翻译</button>
                <div id="testResult" class="test-result" style="display: none;"></div>
            </div>
        </div>

        <!-- 按钮组 -->
        <div class="button-group">
            <button onclick="saveSettings()">保存配置</button>
            <button onclick="loadSettings()">重新加载</button>
        </div>
    </div>

    <script>
        // 获取 VS Code API
        const vscode = acquireVsCodeApi();

        // 页面加载时请求当前配置
        window.addEventListener('load', () => {
            loadSettings();
        });

        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'settingsLoaded':
                    populateForm(message.settings);
                    break;
                case 'settingsSaved':
                    if (message.success) {
                        showMessage('配置保存成功！', 'success');
                    } else {
                        showMessage('保存失败: ' + message.error, 'error');
                    }
                    break;
                case 'testResult':
                    showTestResult(message);
                    break;
            }
        });

        function loadSettings() {
            vscode.postMessage({
                command: 'loadSettings'
            });
        }

        function saveSettings() {
            const settings = {
                defaultEngine: document.getElementById('defaultEngine').value,
                defaultTargetLanguage: document.getElementById('defaultTargetLanguage').value,
                createCopyFile: document.getElementById('createCopyFile').checked,
                autoTranslateOnOpen: document.getElementById('autoTranslateOnOpen').checked,
                openaiApiKey: document.getElementById('openaiApiKey').value,
                openaiModel: document.getElementById('openaiModel').value,
                claudeApiKey: document.getElementById('claudeApiKey').value,
                claudeModel: document.getElementById('claudeModel').value,
                baiduAppId: document.getElementById('baiduAppId').value,
                baiduSecretKey: document.getElementById('baiduSecretKey').value,
                microsoftApiKey: document.getElementById('microsoftApiKey').value,
                microsoftRegion: document.getElementById('microsoftRegion').value,
                siliconflowApiKey: document.getElementById('siliconflowApiKey').value,
                siliconflowModel: document.getElementById('siliconflowModel').value,
                openaiCompatibleApiKey: document.getElementById('openaiCompatibleApiKey').value,
                openaiCompatibleBaseUrl: document.getElementById('openaiCompatibleBaseUrl').value,
                openaiCompatibleModel: document.getElementById('openaiCompatibleModel').value,
                localLlmBaseUrl: document.getElementById('localLlmBaseUrl').value,
                localLlmModel: document.getElementById('localLlmModel').value,
                geminiApiKey: document.getElementById('geminiApiKey').value,
                geminiModel: document.getElementById('geminiModel').value
            };

            vscode.postMessage({
                command: 'saveSettings',
                settings: settings
            });
        }

        function testTranslation() {
            const engine = document.getElementById('defaultEngine').value;
            const text = document.getElementById('testText').value;
            const targetLang = document.getElementById('testTargetLang').value;

            if (!text.trim()) {
                showTestResult({
                    success: false,
                    error: '请输入测试文本'
                });
                return;
            }

            vscode.postMessage({
                command: 'testTranslation',
                engine: engine,
                text: text,
                targetLang: targetLang
            });
        }

        function populateForm(settings) {
            document.getElementById('defaultEngine').value = settings.defaultEngine || 'google';
            document.getElementById('defaultTargetLanguage').value = settings.defaultTargetLanguage || 'auto';
            document.getElementById('createCopyFile').checked = settings.createCopyFile !== false;
            document.getElementById('autoTranslateOnOpen').checked = settings.autoTranslateOnOpen === true;
            document.getElementById('openaiApiKey').value = settings.openaiApiKey || '';
            document.getElementById('openaiModel').value = settings.openaiModel || 'gpt-5';
            document.getElementById('claudeApiKey').value = settings.claudeApiKey || '';
            document.getElementById('claudeModel').value = settings.claudeModel || 'claude-3-7-sonnet-20250219';
            document.getElementById('baiduAppId').value = settings.baiduAppId || '';
            document.getElementById('baiduSecretKey').value = settings.baiduSecretKey || '';
            document.getElementById('microsoftApiKey').value = settings.microsoftApiKey || '';
            document.getElementById('microsoftRegion').value = settings.microsoftRegion || 'global';
            document.getElementById('siliconflowApiKey').value = settings.siliconflowApiKey || '';
            document.getElementById('siliconflowModel').value = settings.siliconflowModel || 'qwen2.5-7b-Instruct';
            document.getElementById('openaiCompatibleApiKey').value = settings.openaiCompatibleApiKey || '';
            document.getElementById('openaiCompatibleBaseUrl').value = settings.openaiCompatibleBaseUrl || '';
            document.getElementById('openaiCompatibleModel').value = settings.openaiCompatibleModel || '';
            document.getElementById('localLlmBaseUrl').value = settings.localLlmBaseUrl || 'http://localhost:11434';
            document.getElementById('localLlmModel').value = settings.localLlmModel || 'qwen2.5-latest';
            document.getElementById('geminiApiKey').value = settings.geminiApiKey || '';
            document.getElementById('geminiModel').value = settings.geminiModel || 'gemini-2.5-flash';
        }

        function showMessage(message, type) {
            // 创建临时消息提示
            const messageDiv = document.createElement('div');
            messageDiv.textContent = message;
            messageDiv.className = type;
            messageDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px; border-radius: 4px; z-index: 1000;';
            document.body.appendChild(messageDiv);

            setTimeout(() => {
                document.body.removeChild(messageDiv);
            }, 3000);
        }

        function showTestResult(result) {
            const resultDiv = document.getElementById('testResult');
            resultDiv.style.display = 'block';

            if (result.success) {
                resultDiv.innerHTML = '<span class="success">✓ 测试成功</span><br>' + result.result;
            } else {
                resultDiv.innerHTML = '<span class="error">✗ 测试失败</span><br>' + result.error;
            }
        }
    </script>
</body>
</html>`;
    }
}