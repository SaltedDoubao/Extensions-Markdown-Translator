import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

    // 监听活动编辑器改变事件
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateButtonContext)
    );

    // 监听配置变更
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(handleConfigurationChange)
    );

    // 初始更新按钮状态
    updateButtonContext();
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

    // 取消翻译
    const undoTranslate = vscode.commands.registerCommand(
        'markdownTranslator.undoTranslate',
        async () => {
            await undoTranslateCurrentDocument();
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
        undoTranslate,
        openSettings
    );
}

function generateCopyFilePath(originalPath: string, targetLanguage?: string): string {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const nameWithoutExt = path.basename(originalPath, ext);

    // 根据新规则，直接使用 _copy 后缀
    return path.join(dir, `${nameWithoutExt}_copy${ext}`);
}

function checkCopyFileExists(originalPath: string): boolean {
    const copyFilePath = generateCopyFilePath(originalPath);
    return fs.existsSync(copyFilePath);
}

function updateButtonContext() {
    const editor = vscode.window.activeTextEditor;
    if (editor && isMarkdownFile(editor.document)) {
        const hasCopyFile = checkCopyFileExists(editor.document.uri.fsPath);
        vscode.commands.executeCommand('setContext', 'markdownTranslator.hasCopyFile', hasCopyFile);
    } else {
        vscode.commands.executeCommand('setContext', 'markdownTranslator.hasCopyFile', false);
    }
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
        const originalPath = document.uri.fsPath;

        // 0. 首先保存当前文档，确保获取到最新内容
        if (document.isDirty) {
            await document.save();
        }

        const text = document.getText();

        // 按照新流程：先复制原文件为 _copy 版本，再翻译原文件
        const copyFilePath = generateCopyFilePath(originalPath);

        // 1. 创建 copy 文件
        const copyFileUri = vscode.Uri.file(copyFilePath);
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(copyFileUri, { ignoreIfExists: false });
        edit.insert(copyFileUri, new vscode.Position(0, 0), text);
        await vscode.workspace.applyEdit(edit);

        // 保存copy文件
        const copyDocument = await vscode.workspace.openTextDocument(copyFileUri);
        await copyDocument.save();

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

        // 2. 翻译原文件
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        const translateEdit = new vscode.WorkspaceEdit();
        translateEdit.replace(document.uri, fullRange, finalContent);
        await vscode.workspace.applyEdit(translateEdit);

        // 保存翻译后的文档
        await document.save();

        // 更新按钮状态
        updateButtonContext();

        vscode.window.showInformationMessage('翻译完成！已创建备份文件: ' + copyFilePath);

    } catch (error) {
        vscode.window.showErrorMessage(`翻译失败: ${error}`);
    }
}

async function undoTranslateCurrentDocument() {
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
        const originalPath = document.uri.fsPath;
        const copyFilePath = generateCopyFilePath(originalPath);

        // 检查 copy 文件是否存在
        if (!fs.existsSync(copyFilePath)) {
            vscode.window.showErrorMessage('找不到备份文件');
            return;
        }

        // 读取 copy 文件的内容
        const copyContent = fs.readFileSync(copyFilePath, 'utf8');

        // 1. 删除翻译后的原文件内容，恢复 copy 文件内容
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, copyContent);
        await vscode.workspace.applyEdit(edit);

        // 保存恢复后的文档
        await document.save();

        // 2. 删除 copy 文件
        const copyFileUri = vscode.Uri.file(copyFilePath);
        const deleteEdit = new vscode.WorkspaceEdit();
        deleteEdit.deleteFile(copyFileUri);
        await vscode.workspace.applyEdit(deleteEdit);

        // 更新按钮状态
        updateButtonContext();

        vscode.window.showInformationMessage('已恢复原文档');

    } catch (error) {
        vscode.window.showErrorMessage(`恢复失败: ${error}`);
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

    if (isMarkdownFile(document)) {
        // 更新按钮状态
        updateButtonContext();

        if (autoTranslateOnOpen) {
            // 延迟一下再自动翻译，确保文档完全加载
            setTimeout(async () => {
                if (vscode.window.activeTextEditor?.document === document) {
                    await autoTranslateCurrentDocument();
                }
            }, 1000);
        }
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
