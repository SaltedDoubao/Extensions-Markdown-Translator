import * as vscode from 'vscode';
import { TranslatorService } from './services/translatorService';
import { MarkdownProcessor } from './utils/markdownProcessor';

let translatorService: TranslatorService;
let markdownProcessor: MarkdownProcessor;

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Translator 扩展已激活');
    
    // 初始化服务
    translatorService = new TranslatorService();
    markdownProcessor = new MarkdownProcessor();
    
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
    
    context.subscriptions.push(
        translateToEnglish,
        translateToChinese,
        translateSelection,
        autoTranslate
    );
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
        const text = document.getText();
        
        // 处理markdown内容，过滤代码块
        const processedContent = markdownProcessor.extractTranslatableContent(text);
        
        if (processedContent.length === 0) {
            vscode.window.showInformationMessage('没有找到需要翻译的内容');
            return;
        }
        
        vscode.window.showInformationMessage('开始翻译文档...');
        
        // 翻译处理后的内容
        const translatedContent = await translatorService.translateBatch(
            processedContent,
            targetLanguage
        );
        
        // 重新组装markdown文档
        const finalContent = markdownProcessor.reassembleContent(
            text,
            processedContent,
            translatedContent
        );
        
        // 替换文档内容
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        edit.replace(document.uri, fullRange, finalContent);
        
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage('文档翻译完成！');
        
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
    const editor = vscode.window.activeTextEditor;
    
    if (!editor || !isMarkdownFile(editor.document)) {
        return;
    }
    
    // 检测文档主要语言并自动选择目标语言
    const text = editor.document.getText();
    const targetLanguage = detectLanguageAndGetTarget(text);
    
    await translateDocument(targetLanguage);
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
