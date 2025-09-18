import * as vscode from 'vscode';
import { TranslatorService } from './services/translatorService';
import { MarkdownProcessor } from './utils/markdownProcessor';
import { LanguageDetector } from './utils/languageDetector';
import { SettingsWebviewProvider } from './webview/settingsWebviewProvider';

let translatorService: TranslatorService;
let markdownProcessor: MarkdownProcessor;
let languageDetector: LanguageDetector;
let settingsWebviewProvider: SettingsWebviewProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Translator 扩展已激活');

    // 初始化服务
    translatorService = new TranslatorService();
    markdownProcessor = new MarkdownProcessor();
    languageDetector = new LanguageDetector();
    settingsWebviewProvider = new SettingsWebviewProvider(context);
    
    // 注册命令
    registerCommands(context);
    
    // 监听文档打开事件（自动翻译功能）
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(handleDocumentOpen)
    );
    
    // 监听配置变更
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(handleConfigurationChange)
    );
}

function registerCommands(context: vscode.ExtensionContext) {
    // 翻译为英文
    const translateToEnglish = vscode.commands.registerCommand(
        'markdownTranslator.translateToEnglish',
        async () => {
            await translateDocument('en');
        }
    );
    
    // 翻译为中文
    const translateToChinese = vscode.commands.registerCommand(
        'markdownTranslator.translateToChinese',
        async () => {
            await translateDocument('zh');
        }
    );
    
    // 翻译选中文本
    const translateSelection = vscode.commands.registerCommand(
        'markdownTranslator.translateSelection',
        async () => {
            await translateSelectedText();
        }
    );
    
    // 自动翻译当前文档
    const autoTranslate = vscode.commands.registerCommand(
        'markdownTranslator.autoTranslate',
        async () => {
            await autoTranslateCurrentDocument();
        }
    );

    // 打开设置页面
    const openSettings = vscode.commands.registerCommand(
        'markdownTranslator.openSettings',
        () => {
            settingsWebviewProvider.show();
        }
    );

    context.subscriptions.push(
        translateToEnglish,
        translateToChinese,
        translateSelection,
        autoTranslate,
        openSettings
    );
}

function generateCopyFilePath(originalPath: string, targetLanguage: string): string {
    const path = require('path');
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const nameWithoutExt = path.basename(originalPath, ext);

    // 特殊处理 README 文件
    if (nameWithoutExt.toLowerCase() === 'readme') {
        const languageCode = getLanguageCode(targetLanguage);
        return path.join(dir, `README.${languageCode}${ext}`);
    }

    // 普通文件添加 -copy 后缀
    return path.join(dir, `${nameWithoutExt}-copy${ext}`);
}

function getLanguageCode(targetLanguage: string): string {
    // 将内部语言代码转换为标准语言代码
    const languageMap: { [key: string]: string } = {
        'zh': 'zh-CN',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de',
        'es': 'es',
        'ru': 'ru'
    };

    return languageMap[targetLanguage] || targetLanguage;
}

async function translateDocument(targetLanguage: string) {
    const config = vscode.workspace.getConfiguration('markdownTranslator');
    const createCopyFile = config.get<boolean>('createCopyFile', true);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('没有打开的编辑器');
        return;
    }

    if (!isMarkdownFile(editor.document)) {
        vscode.window.showErrorMessage('当前文件不是Markdown文档');
        return;
    }

    try {
        const document = editor.document;
        const text = document.getText();
        const originalPath = document.uri.fsPath;

        // 处理markdown内容，过滤代码块
        const extractResult = markdownProcessor.extractTranslatableContent(text);

        if (extractResult.translatableLines.length === 0) {
            vscode.window.showInformationMessage('没有找到需要翻译的内容');
            return;
        }

        vscode.window.showInformationMessage('开始翻译文档...');

        // 翻译处理后的内容
        const translatedContent = await translatorService.translateBatch(
            extractResult.translatableLines,
            targetLanguage
        );

        // 重新组装markdown文档
        const finalContent = markdownProcessor.reassembleContent(
            extractResult.lineStructure,
            translatedContent,
            extractResult.placeholderMap
        );

        if (createCopyFile) {
            // 生成副本文件而不是修改原文件
            const newFilePath = generateCopyFilePath(originalPath, targetLanguage);
            const newFileUri = vscode.Uri.file(newFilePath);

            // 创建新文件
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(newFileUri, { ignoreIfExists: true });
            edit.insert(newFileUri, new vscode.Position(0, 0), finalContent);

            await vscode.workspace.applyEdit(edit);

            // 打开新创建的文件
            const newDocument = await vscode.workspace.openTextDocument(newFileUri);
            await vscode.window.showTextDocument(newDocument);

            vscode.window.showInformationMessage(`翻译完成！已生成副本文件: ${newFilePath}`);
        } else {
            // 直接修改当前文件（原有行为）
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            edit.replace(document.uri, fullRange, finalContent);

            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('文档翻译完成！');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`翻译失败: ${error}`);
    }
}

async function translateSelectedText() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('没有打开的编辑器');
        return;
    }
    
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('请先选中要翻译的文本');
        return;
    }
    
    try {
        const selectedText = editor.document.getText(selection);
        
        // 检测语言并确定目标语言
        const targetLanguage = detectLanguageAndGetTarget(selectedText);
        
        vscode.window.showInformationMessage('正在翻译选中文本...');
        
        const translatedText = await translatorService.translate(
            selectedText,
            targetLanguage
        );
        
        // 替换选中的文本
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, selection, translatedText);
        
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage('翻译完成！');
        
    } catch (error) {
        vscode.window.showErrorMessage(`翻译失败: ${error}`);
    }
}

async function autoTranslateCurrentDocument() {
    const config = vscode.workspace.getConfiguration('markdownTranslator');
    const defaultTargetLanguage = config.get<string>('defaultTargetLanguage', 'zh-CN');

    const editor = vscode.window.activeTextEditor;

    if (!editor || !isMarkdownFile(editor.document)) {
        return;
    }

    const text = editor.document.getText();

    // 使用新的语言检测器
    if (defaultTargetLanguage !== 'auto') {
        // 检测文档语言，如果与目标语言相同则选择替代语言
        const internalTargetCode = getInternalLanguageCode(defaultTargetLanguage);
        const detectedLanguage = languageDetector.detectLanguage(text);

        if (languageDetector.isSameLanguage(detectedLanguage, internalTargetCode)) {
            const alternativeTarget = languageDetector.detectAndGetTargetLanguage(text, internalTargetCode);
            await translateDocument(alternativeTarget);
            vscode.window.showInformationMessage(
                `检测到文档语言为${getLanguageDisplayName(detectedLanguage)}，已自动选择${getLanguageDisplayName(alternativeTarget)}作为目标语言`
            );
        } else {
            await translateDocument(internalTargetCode);
        }
    } else {
        // 自动检测并选择最佳目标语言
        const targetLanguage = languageDetector.detectAndGetTargetLanguage(text);
        await translateDocument(targetLanguage);
    }
}

function getLanguageDisplayName(langCode: string): string {
    const names: { [key: string]: string } = {
        'zh': '中文',
        'en': '英文',
        'ja': '日文',
        'ko': '韩文',
        'fr': '法文',
        'de': '德文',
        'es': '西班牙文',
        'ru': '俄文'
    };
    return names[langCode] || langCode;
}

function getInternalLanguageCode(configLanguage: string): string {
    // 将配置的语言代码转换为内部使用的语言代码
    const codeMap: { [key: string]: string } = {
        'zh-CN': 'zh',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de',
        'es': 'es',
        'ru': 'ru'
    };

    return codeMap[configLanguage] || 'zh';
}

async function handleDocumentOpen(document: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration('markdownTranslator');
    const autoTranslateOnOpen = config.get<boolean>('autoTranslateOnOpen', false);
    
    if (autoTranslateOnOpen && isMarkdownFile(document)) {
        // 延迟一下再自动翻译，确保文档完全加载
        setTimeout(async () => {
            if (vscode.window.activeTextEditor?.document === document) {
                await autoTranslateCurrentDocument();
            }
        }, 1000);
    }
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration('markdownTranslator')) {
        // 重新初始化翻译服务
        translatorService.updateConfiguration();
        vscode.window.showInformationMessage('翻译器配置已更新');
    }
}

function isMarkdownFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
}

function detectLanguageAndGetTarget(text: string): string {
    // 简单的语言检测逻辑
    const chinesePattern = /[\u4e00-\u9fff]/g;
    const chineseMatches = text.match(chinesePattern);
    const chineseRatio = chineseMatches ? chineseMatches.length / text.length : 0;
    
    // 如果中文字符占比超过30%，认为是中文文档，翻译为英文
    // 否则认为是英文文档，翻译为中文
    return chineseRatio > 0.3 ? 'en' : 'zh';
}

export function deactivate() {
    console.log('Markdown Translator 扩展已停用');
}
