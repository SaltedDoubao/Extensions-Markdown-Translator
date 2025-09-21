import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';

export class ClaudeEngine extends BaseLLMEngine {
  name = 'Anthropic Claude';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeApiKey');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeModel', 'claude-3-5-sonnet-20241022');

    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    const url = 'https://api.anthropic.com/v1/messages';

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
    const apiKey = vscode.workspace.getConfiguration('mdTranslator').get<string>('claudeApiKey');
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