import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class ZhipuEngine extends BaseLLMEngine {
  name = 'Zhipu AI';

  private readonly apiEndpoint = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('zhipu');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('zhipuModel', 'glm-4-flash');

    if (!apiKey) {
      throw new Error('Zhipu API key not configured');
    }

    const body = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1,
      max_tokens: Math.min(8000, text.length * 3)
    });

    try {
      const response = await this.makeHttpRequest(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 120000,
        body
      });

      if (response.choices?.[0]?.message?.content) {
        return this.cleanLLMResponse(response.choices[0].message.content);
      }

      throw new Error('Invalid response format from Zhipu API');
    } catch (error) {
      throw new Error(`Zhipu API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    return secretStorage.hasApiKeySync('zhipu');
  }

  async validateConfig(): Promise<boolean> {
    try {
      const secretStorage = getSecretStorageManager();
      const apiKey = await secretStorage.getApiKeyWithFallback('zhipu');
      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('zhipuModel', 'glm-4-flash');

      if (!apiKey) {
        return false;
      }

      const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        max_tokens: 1
      });

      const response = await this.makeHttpRequest(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 60000,
        body
      });

      return !!(response && (response.choices || response.id));
    } catch {
      return false;
    }
  }
}

