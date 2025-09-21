import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';

export class LMStudioEngine extends BaseLLMEngine {
  name = 'LM Studio';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioBaseUrl', 'http://localhost:1234');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioModel', 'local-model');

    if (!baseUrl) {
      throw new Error('LM Studio base URL not configured');
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
          'Content-Type': 'application/json'
        },
        body,
        timeout: 60000 // LM Studio可能需要更长时间
      });

      if (response.choices?.[0]?.message?.content) {
        return this.cleanLLMResponse(response.choices[0].message.content);
      } else {
        throw new Error('Invalid response format from LM Studio');
      }
    } catch (error) {
      throw new Error(`LM Studio API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioBaseUrl');
    return !!baseUrl;
  }

  async validateConfig(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // 检查LM Studio是否运行
      const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioBaseUrl', 'http://localhost:1234');

      // 首先检查模型端点是否可用
      const modelsUrl = `${baseUrl.replace(/\/$/, '')}/v1/models`;
      await this.makeHttpRequest(modelsUrl, {
        method: 'GET',
        headers: {}
      });

      // 测试翻译
      await this.translate('Hello', { targetLanguage: 'zh-CN' });
      return true;
    } catch {
      return false;
    }
  }
}