import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class XAIEngine extends BaseLLMEngine {
  name = 'xAI Grok';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('xai');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('xaiModel', 'grok-4-0709');

    if (!apiKey) {
      throw new Error('xAI API key not configured');
    }

    const url = 'https://api.x.ai/v1/chat/completions';

    const body = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1,
      max_tokens: Math.min(4096, text.length * 3),
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body
      });

      if (response.choices?.[0]?.message?.content) {
        return this.cleanLLMResponse(response.choices[0].message.content);
      } else {
        throw new Error('Invalid response format from xAI');
      }
    } catch (error) {
      throw new Error(`xAI API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    return secretStorage.hasApiKeySync('xai');
  }

  async validateConfig(): Promise<boolean> {
    try {
      const secretStorage = getSecretStorageManager();
      const apiKey = await secretStorage.getApiKeyWithFallback('xai');
      if (!apiKey) {
        return false;
      }

      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('xaiModel', 'grok-4-0709');
      const url = 'https://api.x.ai/v1/chat/completions';

      const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0
      });

      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body
      });

      return !!(response && (response.id || response.choices));
    } catch {
      return false;
    }
  }
}

