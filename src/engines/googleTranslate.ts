import * as vscode from 'vscode';
import { BaseTranslationEngine, TranslationConfig } from './baseEngine';

export class GoogleTranslateEngine extends BaseTranslationEngine {
  name = 'Google Translate';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('googleApiKey');

    if (!apiKey) {
      throw new Error('Google Translate API key not configured');
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const body = JSON.stringify({
      q: text,
      target: this.getLanguageCode(config.targetLanguage),
      source: config.sourceLanguage ? this.getLanguageCode(config.sourceLanguage) : undefined,
      format: 'text'
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });

      if (response.data?.translations?.[0]?.translatedText) {
        return response.data.translations[0].translatedText;
      } else {
        throw new Error('Invalid response format from Google Translate');
      }
    } catch (error) {
      throw new Error(`Google Translate error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('googleApiKey');
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