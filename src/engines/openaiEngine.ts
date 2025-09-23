import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class OpenAIEngine extends BaseLLMEngine {
  name = 'OpenAI GPT';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('openai');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiModel', 'gpt-4o-mini');

    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const url = 'https://api.openai.com/v1/chat/completions';

    const body = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
        }
      ],
      temperature: 0.1,
      max_tokens: Math.min(4096, text.length * 3), // 更合理的token限制
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
        throw new Error('Invalid response format from OpenAI');
      }
    } catch (error) {
      throw new Error(`OpenAI API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('openaiApiKey');
    return !!apiKey;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      await this.translate('Hello', { targetLanguage: 'zh-CN' });
      return true;
    } catch {
      return false;
    }
  }
}