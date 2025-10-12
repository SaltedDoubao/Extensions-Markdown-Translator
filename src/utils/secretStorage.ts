import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const fsPromises = fs.promises;

/**
 * 密钥存储管理器：将 API key 保存在插件目录下的本地文件中
 */
export class SecretStorageManager {
  private readonly secrets: vscode.SecretStorage;
  private readonly storageDir: string;
  private readonly storageFilePath: string;
  private cache: Record<string, string> | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
    this.storageDir = path.join(context.extensionPath, '.mdt-secrets');
    this.storageFilePath = path.join(this.storageDir, 'api-keys.json');
  }

  private getSecretStorageKey(provider: string): string {
    return `mdTranslator.${provider}.apiKey`;
  }

  private async ensureStorageDir(): Promise<void> {
    await fsPromises.mkdir(this.storageDir, { recursive: true });
  }

  private loadCacheSync(): void {
    if (this.cache) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.storageFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.cache = (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('读取 API 密钥文件失败:', error);
      }
      this.cache = {};
    }
  }

  private async readCache(): Promise<Record<string, string>> {
    this.loadCacheSync();
    return this.cache ?? {};
  }

  private async writeCache(cache: Record<string, string>): Promise<void> {
    this.cache = { ...cache };

    if (Object.keys(this.cache).length === 0) {
      try {
        await fsPromises.unlink(this.storageFilePath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          console.error('删除 API 密钥文件失败:', error);
        }
      }
      return;
    }

    await this.ensureStorageDir();
    await fsPromises.writeFile(this.storageFilePath, JSON.stringify(this.cache, null, 2), 'utf8');
  }

  /**
   * 存储（或删除）API 密钥
   */
  async storeApiKey(provider: string, apiKey?: string): Promise<void> {
    const trimmedKey = (apiKey ?? '').trim();

    if (!trimmedKey) {
      await this.deleteApiKey(provider);
      return;
    }

    const cache = await this.readCache();
    cache[provider] = trimmedKey;
    await this.writeCache(cache);

    // 清理 VS Code Secret Storage 中的旧数据
    await this.secrets.delete(this.getSecretStorageKey(provider));
  }

  /**
   * 获取 API 密钥
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    const cache = await this.readCache();
    if (cache[provider]) {
      return cache[provider];
    }

    const legacyKey = await this.secrets.get(this.getSecretStorageKey(provider));
    if (legacyKey && legacyKey.trim()) {
      await this.storeApiKey(provider, legacyKey);
      return legacyKey.trim();
    }

    return undefined;
  }

  /**
   * 删除 API 密钥
   */
  async deleteApiKey(provider: string): Promise<void> {
    const cache = await this.readCache();
    if (cache[provider]) {
      delete cache[provider];
      await this.writeCache(cache);
    }

    await this.secrets.delete(this.getSecretStorageKey(provider));
  }

  /**
   * 迁移旧配置中的密钥到新的本地存储
   */
  async migrateFromPlainTextConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdTranslator');
    const providers = [
      'google',
      'microsoft',
      'openai',
      'claude',
      'gemini',
      'openaiCompatible',
      'zhipu'
    ];

    for (const provider of providers) {
      // 如果文件中已经存在，则跳过
      const existing = await this.getApiKey(provider);
      if (existing) {
        await this.clearPlainTextConfig(config, provider);
        continue;
      }

      // Secret Storage 中的旧数据
      const legacySecret = await this.secrets.get(this.getSecretStorageKey(provider));
      if (legacySecret && legacySecret.trim()) {
        await this.storeApiKey(provider, legacySecret);
        await this.clearPlainTextConfig(config, provider);
        continue;
      }

      // settings.json 中的旧数据
      const configKey = `${provider}ApiKey`;
      const plainTextKey = config.get<string>(configKey);
      if (plainTextKey && plainTextKey.trim()) {
        await this.storeApiKey(provider, plainTextKey);
        await this.clearPlainTextConfig(config, provider);
        console.log(`已迁移 ${provider} API 密钥到插件目录存储`);
      }
    }
  }

  private async clearPlainTextConfig(config: vscode.WorkspaceConfiguration, provider: string) {
    const configKey = `${provider}ApiKey`;
    await config.update(configKey, undefined, vscode.ConfigurationTarget.Workspace);
    await config.update(configKey, undefined, vscode.ConfigurationTarget.Global);
  }

  /**
   * 检查是否存在可用的 API 密钥
   */
  async hasApiKey(provider: string): Promise<boolean> {
    const cache = await this.readCache();
    if (cache[provider]) {
      return true;
    }

    const legacySecret = await this.secrets.get(this.getSecretStorageKey(provider));
    if (legacySecret && legacySecret.trim()) {
      await this.storeApiKey(provider, legacySecret);
      return true;
    }

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const configKey = `${provider}ApiKey`;
    const plainTextKey = config.get<string>(configKey);
    if (plainTextKey && plainTextKey.trim()) {
      await this.storeApiKey(provider, plainTextKey);
      return true;
    }

    return false;
  }

  hasApiKeySync(provider: string): boolean {
    this.loadCacheSync();
    if (this.cache?.[provider]) {
      return true;
    }

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const configKey = `${provider}ApiKey`;
    const plainTextKey = config.get<string>(configKey);
    return !!(plainTextKey && plainTextKey.trim());
  }

  /**
   * 读取 API 密钥，优先新存储，其次 Secret Storage，再回退到旧配置
   */
  async getApiKeyWithFallback(provider: string): Promise<string | undefined> {
    const stored = await this.getApiKey(provider);
    if (stored) {
      return stored;
    }

    const config = vscode.workspace.getConfiguration('mdTranslator');
    const configKey = `${provider}ApiKey`;
    const plainTextKey = config.get<string>(configKey);
    if (plainTextKey && plainTextKey.trim()) {
      await this.storeApiKey(provider, plainTextKey);
      await this.clearPlainTextConfig(config, provider);
      return plainTextKey.trim();
    }

    return undefined;
  }
}