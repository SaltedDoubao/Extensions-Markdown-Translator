import * as vscode from 'vscode';

/**
 * 安全存储管理器，用于加密存储敏感信息如API密钥
 */
export class SecretStorageManager {
  private readonly secrets: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
  }

  /**
   * 存储API密钥
   */
  async storeApiKey(provider: string, apiKey: string): Promise<void> {
    const key = `mdTranslator.${provider}.apiKey`;
    await this.secrets.store(key, apiKey);
  }

  /**
   * 获取API密钥
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    const key = `mdTranslator.${provider}.apiKey`;
    return await this.secrets.get(key);
  }

  /**
   * 删除API密钥
   */
  async deleteApiKey(provider: string): Promise<void> {
    const key = `mdTranslator.${provider}.apiKey`;
    await this.secrets.delete(key);
  }

  /**
   * 从旧的明文配置迁移到安全存储
   */
  async migrateFromPlainTextConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('mdTranslator');
    const providers = [
      'google',
      'microsoft',
      'openai',
      'claude',
      'gemini',
      'openaiCompatible'
    ];

    for (const provider of providers) {
      const configKey = `${provider}ApiKey`;
      const existingKey = config.get<string>(configKey);

      if (existingKey && existingKey.trim()) {
        // 迁移到安全存储
        await this.storeApiKey(provider, existingKey);

        // 清除明文配置
        await config.update(configKey, undefined, vscode.ConfigurationTarget.Workspace);
        await config.update(configKey, undefined, vscode.ConfigurationTarget.Global);

        console.log(`已迁移 ${provider} API 密钥到安全存储`);
      }
    }
  }

  /**
   * 检查是否有API密钥配置（安全存储或明文配置）
   */
  async hasApiKey(provider: string): Promise<boolean> {
    // 首先检查安全存储
    const secureKey = await this.getApiKey(provider);
    if (secureKey) {
      return true;
    }

    // 检查旧的明文配置
    const config = vscode.workspace.getConfiguration('mdTranslator');
    const configKey = `${provider}ApiKey`;
    const plainTextKey = config.get<string>(configKey);

    return !!(plainTextKey && plainTextKey.trim());
  }

  /**
   * 获取API密钥，优先从安全存储，回退到明文配置
   */
  async getApiKeyWithFallback(provider: string): Promise<string | undefined> {
    // 首先尝试从安全存储获取
    const secureKey = await this.getApiKey(provider);
    if (secureKey) {
      return secureKey;
    }

    // 回退到明文配置（为了向后兼容）
    const config = vscode.workspace.getConfiguration('mdTranslator');
    const configKey = `${provider}ApiKey`;
    const plainTextKey = config.get<string>(configKey);

    if (plainTextKey && plainTextKey.trim()) {
      // 自动迁移到安全存储
      await this.storeApiKey(provider, plainTextKey);
      await config.update(configKey, undefined, vscode.ConfigurationTarget.Workspace);
      await config.update(configKey, undefined, vscode.ConfigurationTarget.Global);

      return plainTextKey;
    }

    return undefined;
  }
}