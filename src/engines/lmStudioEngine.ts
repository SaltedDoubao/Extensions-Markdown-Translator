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
    try {
      const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioBaseUrl', 'http://localhost:1234');
      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('lmStudioModel', 'local-model');
      if (!baseUrl) {
        return false;
      }

      // 先检查服务与模型列表
      const modelsUrl = `${baseUrl.replace(/\/$/, '')}/v1/models`;
      const models = await this.makeHttpRequest(modelsUrl, {
        method: 'GET',
        headers: {}
      });

      if (model) {
        const hasModel = Array.isArray(models?.data)
          ? models.data.some((m: any) => m.id === model || m.id?.includes(model))
          : true; // 若无法列出模型，则不阻塞后续 ping
        if (!hasModel) {
          return false;
        }
      }

      // 最小化 ping 请求
      const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      const body = JSON.stringify({
        model: model || 'local-model',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
        stream: false
      });
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeout: 20000
      });
      return !!(response && (response.id || response.choices));
    } catch {
      return false;
    }
  }
}