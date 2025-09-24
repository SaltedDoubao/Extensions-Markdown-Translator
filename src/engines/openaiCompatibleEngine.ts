import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class OpenAICompatibleEngine extends BaseLLMEngine {
  name = 'OpenAI Compatible API';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('openaiCompatible');
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleBaseUrl');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleModel', 'gpt-4o-mini');

    if (!apiKey || !baseUrl) {
      throw new Error('OpenAI Compatible API key or base URL not configured');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

    const body = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1,
      max_tokens: Math.min(4000, text.length * 3),
      stream: false
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
        throw new Error('Invalid response format from OpenAI Compatible API');
      }
    } catch (error) {
      throw new Error(`OpenAI Compatible API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleApiKey');
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleBaseUrl');
    return !!(apiKey && baseUrl);
  }

  async validateConfig(): Promise<boolean> {
    try {
      const secretStorage = getSecretStorageManager();
      const apiKey = await secretStorage.getApiKeyWithFallback('openaiCompatible');
      const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleBaseUrl');
      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiCompatibleModel', 'gpt-4o-mini');
      if (!apiKey || !baseUrl) {
        return false;
      }

      const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const body = JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        stream: false
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