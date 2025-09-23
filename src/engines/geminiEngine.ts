import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class GeminiEngine extends BaseLLMEngine {
  name = 'Google Gemini';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('gemini');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('geminiModel', 'gemini-2.0-flash');

    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage)
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: Math.min(8192, text.length * 3),
        topP: 0.95,
        topK: 20
      }
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body
      });

      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        return this.cleanLLMResponse(response.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    return secretStorage.hasApiKey('gemini')
      .then(hasKey => hasKey)
      .catch(() => false) as any;
  }

  async validateConfig(): Promise<boolean> {
    const secretStorage = getSecretStorageManager();
    const hasKey = await secretStorage.hasApiKey('gemini');
    if (!hasKey) {
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