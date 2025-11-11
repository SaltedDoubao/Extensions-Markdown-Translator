import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Translator } from './translator';
import { SettingsWebviewProvider } from './settingsWebviewProvider';
import { SecretStorageManager } from './utils/secretStorage';
import { ExtensionTranslationManager } from './services/extensionTranslationManager';
import { ExtensionTranslationWebviewProvider } from './services/extensionTranslationWebviewProvider';

let translator: Translator;
let settingsWebviewProvider: SettingsWebviewProvider;
let secretStorageManager: SecretStorageManager;
let extensionTranslationManager: ExtensionTranslationManager;
let extensionTranslationWebviewProvider: ExtensionTranslationWebviewProvider;

export function activate(context: vscode.ExtensionContext) {
  translator = new Translator(context);
  settingsWebviewProvider = new SettingsWebviewProvider(context);
  secretStorageManager = new SecretStorageManager(context);
  extensionTranslationManager = new ExtensionTranslationManager(context);
  extensionTranslationWebviewProvider = new ExtensionTranslationWebviewProvider(
    context,
    extensionTranslationManager,
    translator
  );

  // 执行安全存储迁移
  migrateToSecureStorage();

  // 注册所有命令
  registerCommands(context);

  // 监听活动编辑器改变事件，更新按钮状态
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateButtonContext)
  );

  // 初始更新按钮状态
  updateButtonContext();
}

function registerCommands(context: vscode.ExtensionContext) {
  // 原有的翻译命令
  const translateCurrentFile = vscode.commands.registerCommand('mdtranslate.translateCurrentFile', async () => {
    await translateDocument();
  });

  // 自动翻译命令（选项卡栏"翻译"按钮）
  const autoTranslate = vscode.commands.registerCommand('mdtranslate.autoTranslate', async () => {
    await translateDocument();
  });

  // 撤销翻译命令（选项卡栏"返回"按钮）
  const undoTranslate = vscode.commands.registerCommand('mdtranslate.undoTranslate', async () => {
    await undoTranslateCurrentDocument();
  });

  // 打开设置页面命令
  const openSettings = vscode.commands.registerCommand('mdtranslate.openSettings', () => {
    settingsWebviewProvider.show();
  });

  // 再次翻译命令（选项卡栏"再次翻译"按钮）
  const retranslate = vscode.commands.registerCommand('mdtranslate.retranslate', async () => {
    await retranslateDocument();
  });

  // 扩展翻译命令
  const translateExtension = vscode.commands.registerCommand('mdtranslate.translateExtension', async () => {
    await extensionTranslationWebviewProvider.show();
  });

  // 通过扩展ID翻译命令
  const translateExtensionById = vscode.commands.registerCommand('mdtranslate.translateExtensionById', async () => {
    const extensionId = await vscode.window.showInputBox({
      prompt: '请输入扩展ID (格式: publisher.name) 或 Marketplace URL',
      placeHolder: '例如: ms-python.python',
      validateInput: (value) => {
        if (!value.trim()) {
          return '请输入扩展ID或URL';
        }
        return null;
      }
    });

    if (extensionId) {
      // 如果输入的是URL，提取扩展ID
      let finalExtensionId = extensionId;
      if (extensionId.includes('marketplace.visualstudio.com')) {
        const match = extensionId.match(/itemName=([^&]+)/);
        if (match) {
          finalExtensionId = match[1];
        } else {
          vscode.window.showErrorMessage('无法从URL中提取扩展ID');
          return;
        }
      }

      await extensionTranslationWebviewProvider.show(finalExtensionId);
    }
  });

  context.subscriptions.push(translateCurrentFile, autoTranslate, undoTranslate, openSettings, retranslate, translateExtension, translateExtensionById);
}

async function translateDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('请打开一个 Markdown 文件再运行翻译命令。');
    return;
  }
  const doc = editor.document;
  if (doc.languageId !== 'markdown' && !doc.fileName.endsWith('.md')) {
    const proceed = await vscode.window.showWarningMessage('当前文件并非 Markdown。是否继续翻译？', '继续', '取消');
    if (proceed !== '继续') {
      return;
    }
  }

  try {
    const originalPath = doc.uri.fsPath;

    // 首先保存当前文档
    if (doc.isDirty) {
      await doc.save();
    }

    const text = doc.getText();
    const copyFilePath = generateCopyFilePath(originalPath);

    // 创建备份文件
    const copyFileUri = vscode.Uri.file(copyFilePath);
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(copyFileUri, { ignoreIfExists: false });
    edit.insert(copyFileUri, new vscode.Position(0, 0), text);
    await vscode.workspace.applyEdit(edit);

    // 保存备份文件
    const copyDocument = await vscode.workspace.openTextDocument(copyFileUri);
    await copyDocument.save();

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const targetLang = config.get<string>('targetLanguage', 'zh-CN');
    const enableChunkMode = config.get<boolean>('longContextOptimization', false);
    const chunkSize = config.get<number>('longContextChunkSize', 5000);
    const useQueue = config.get<boolean>('useTranslationQueue', true); // 默认启用队列模式

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: '正在翻译 Markdown', cancellable: true },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          translator.cancel();
        });
        const safeChunkSize = enableChunkMode ? Math.max(500, Math.min(chunkSize || 5000, 20000)) : undefined;

        const appendToDocument = async (content: string) => {
          const currentText = doc.getText();
          const endPosition = doc.positionAt(currentText.length);
          const editInsert = new vscode.WorkspaceEdit();
          editInsert.insert(doc.uri, endPosition, content);
          await vscode.workspace.applyEdit(editInsert);
          await doc.save();
        };

        const restoreFromBackup = async () => {
          try {
            const original = fs.readFileSync(copyFilePath, 'utf8');
            const range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            const restoreEdit = new vscode.WorkspaceEdit();
            restoreEdit.replace(doc.uri, range, original);
            await vscode.workspace.applyEdit(restoreEdit);
            await doc.save();
          } catch (restoreError) {
            console.error('恢复原文失败:', restoreError);
          }
        };
        try {
          progress.report({ message: '准备中...' });

          if (enableChunkMode) {
            const clearEdit = new vscode.WorkspaceEdit();
            clearEdit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), '');
            await vscode.workspace.applyEdit(clearEdit);
            await doc.save();
          }

          let chunkCount = 0;
          const result = await translator.translateMarkdown(text, {
            targetLang,
            progress,
            token,
            chunkSize: safeChunkSize,
            useQueue, // 使用队列模式
            onChunkTranslated: enableChunkMode
              ? async ({ index, total, translated }) => {
                  chunkCount = total;
                  const prefix = index === 0 ? '' : '\n\n';
                  await appendToDocument(prefix + translated);
                  progress.report?.({ message: `批次 ${index + 1}/${total} 已完成` });
                }
              : undefined
          });
          if (token.isCancellationRequested) {
            if (enableChunkMode) {
              await restoreFromBackup();
            }
            vscode.window.showWarningMessage('翻译已取消');
            return;
          }

          if (!enableChunkMode || chunkCount === 0) {
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            const translateEdit = new vscode.WorkspaceEdit();
            translateEdit.replace(doc.uri, fullRange, result);
            await vscode.workspace.applyEdit(translateEdit);
            await doc.save();
          }

          // 更新按钮状态
          updateButtonContext();
          vscode.window.showInformationMessage('翻译完成！已创建备份文件: ' + copyFilePath);
        } catch (err: any) {
          if (err.message.includes('用户取消翻译') || err.message.includes('请求已取消')) {
            if (enableChunkMode) {
              await restoreFromBackup();
            }
            vscode.window.showInformationMessage('翻译已取消');
          } else {
            if (enableChunkMode) {
              await restoreFromBackup();
            }
            vscode.window.showErrorMessage('翻译失败: ' + (err?.message ?? String(err)));
          }
        }
      }
    );
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

  // 如果正在翻译，先中止翻译任务
  if (translator.isTranslating()) {
    translator.cancel();
    vscode.window.showInformationMessage('已中止翻译任务');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  try {
    const document = editor.document;
    const originalPath = document.uri.fsPath;
    const copyFilePath = generateCopyFilePath(originalPath);

    // 检查备份文件是否存在
    if (!fs.existsSync(copyFilePath)) {
      vscode.window.showErrorMessage('找不到备份文件');
      return;
    }

    // 读取备份文件内容
    const copyContent = fs.readFileSync(copyFilePath, 'utf8');

    // 恢复原文件内容
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, copyContent);
    await vscode.workspace.applyEdit(edit);
    await document.save();

    // 删除备份文件
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

async function retranslateDocument() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('请打开一个 Markdown 文件再运行翻译命令。');
    return;
  }

  if (!isMarkdownFile(editor.document)) {
    vscode.window.showErrorMessage('当前文件不是Markdown文档');
    return;
  }

  const originalPath = editor.document.uri.fsPath;
  const copyFilePath = generateCopyFilePath(originalPath);

  // 检查是否已翻译（是否有备份文件）
  if (!fs.existsSync(copyFilePath)) {
    vscode.window.showErrorMessage('当前文档未翻译，无法执行再次翻译');
    return;
  }

  // 先恢复原文档
  try {
    const copyContent = fs.readFileSync(copyFilePath, 'utf8');
    const document = editor.document;
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, copyContent);
    await vscode.workspace.applyEdit(edit);
    await document.save();

    // 清空翻译缓存
    translator.clearCache();

    // 重新翻译
    await translateDocument();

  } catch (error) {
    vscode.window.showErrorMessage(`再次翻译失败: ${error}`);
  }
}

function generateCopyFilePath(originalPath: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const nameWithoutExt = path.basename(originalPath, ext);
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
    vscode.commands.executeCommand('setContext', 'mdTranslator.hasCopyFile', hasCopyFile);
  } else {
    vscode.commands.executeCommand('setContext', 'mdTranslator.hasCopyFile', false);
  }
}

function isMarkdownFile(document: vscode.TextDocument): boolean {
  return document.languageId === 'markdown';
}

async function migrateToSecureStorage() {
  try {
    await secretStorageManager.migrateFromPlainTextConfig();
  } catch (error) {
    console.error('迁移到安全存储时出错:', error);
  }
}

export function getSecretStorageManager(): SecretStorageManager {
  return secretStorageManager;
}

export function deactivate() {
  // nothing
}