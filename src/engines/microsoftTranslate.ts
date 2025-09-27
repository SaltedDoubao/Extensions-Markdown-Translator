import * as vscode from 'vscode';
import { BaseTranslationEngine, TranslationConfig } from './baseEngine';
import { getSecretStorageManager } from '../extension';

export class MicrosoftTranslateEngine extends BaseTranslationEngine {
  name = 'Microsoft Translator';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const secretStorage = getSecretStorageManager();
    const apiKey = await secretStorage.getApiKeyWithFallback('microsoft');
    const region = vscode.workspace.getConfiguration('mdTranslator').get<string>('microsoftRegion', 'global');

    if (!apiKey) {
      throw new Error('Microsoft Translator API key not configured');
    }

    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${this.getLanguageCode(config.targetLanguage)}`;

    const body = JSON.stringify([{
      text: text
    }]);

    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/json',
      'Content-Length': body.length.toString()
    };

    if (region !== 'global') {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers,
        body
      });

      if (Array.isArray(response) && response[0]?.translations?.[0]?.text) {
        return response[0].translations[0].text;
      } else {
        throw new Error('Invalid response format from Microsoft Translator');
      }
    } catch (error) {
      throw new Error(`Microsoft Translator error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const secretStorage = getSecretStorageManager();
    return secretStorage.hasApiKeySync('microsoft');
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

  protected getLanguageCode(lang: string): string {
    const langMap: { [key: string]: string } = {
      'zh-CN': 'zh-Hans',
      'zh-TW': 'zh-Hant',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'ru': 'ru',
      'ar': 'ar',
      'hi': 'hi',
      'pt': 'pt',
      'it': 'it'
    };
    return langMap[lang] || lang;
  }
}