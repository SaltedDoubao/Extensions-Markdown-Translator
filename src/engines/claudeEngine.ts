import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class ClaudeEngine extends BaseLLMEngine {
  name = 'Anthropic Claude';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('claude');
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeBaseUrl', 'https://api.anthropic.com');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeModel', 'claude-3-5-sonnet-20241022');

    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    if (!baseUrl) {
      throw new Error('Claude base URL not configured');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;

    const body = JSON.stringify({
      model: model,
      max_tokens: Math.min(8192, text.length * 3), // 增加max_tokens限制
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body
      });

      if (response.content?.[0]?.text) {
        return this.cleanLLMResponse(response.content[0].text);
      } else {
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error) {
      throw new Error(`Claude API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeBaseUrl', 'https://api.anthropic.com');

    return !!baseUrl && secretStorage.hasApiKeySync('claude');
  }

  async validateConfig(): Promise<boolean> {
    try {
      const secretStorage = getSecretStorageManager();
      const apiKey = await secretStorage.getApiKeyWithFallback('claude');
      const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeBaseUrl', 'https://api.anthropic.com');
      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeModel', 'claude-3-5-sonnet-20241022');
      if (!apiKey || !baseUrl) {
        return false;
      }

      const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
      const body = JSON.stringify({
        model,
        max_tokens: 1,
        messages: [
          { role: 'user', content: 'ping' }
        ]
      });

      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body
      });

      return !!(response && (response.id || response.content));
    } catch {
      return false;
    }
  }
}