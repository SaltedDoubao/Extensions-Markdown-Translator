import * as vscode from 'vscode';
import { BaseLLMEngine } from './baseLLMEngine';
import { TranslationConfig } from './baseEngine';

export class OllamaEngine extends BaseLLMEngine {
  name = 'Ollama';

  async translate(text: string, config: TranslationConfig): Promise<string> {
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaBaseUrl', 'http://localhost:11434');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaModel', 'llama3.2');

    if (!baseUrl || !model) {
      throw new Error('Ollama base URL or model not configured');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;

    const body = JSON.stringify({
      model: model,
      prompt: this.getTranslationPrompt(text, config.targetLanguage, config.sourceLanguage),
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        top_k: 20
      }
    });

    try {
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body,
        timeout: 60000 // Ollama可能需要更长时间
      });

      if (response.response) {
        return this.cleanLLMResponse(response.response);
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      throw new Error(`Ollama API error: ${error}`);
    }
  }

  isConfigured(): boolean {
    const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaBaseUrl');
    const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaModel');
    return !!(baseUrl && model);
  }

  async validateConfig(): Promise<boolean> {
    try {
      const baseUrl = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaBaseUrl', 'http://localhost:11434');
      const model = vscode.workspace.getConfiguration('mdTranslator').get<string>('ollamaModel', 'llama3.2');
      if (!baseUrl || !model) {
        return false;
      }

      // 先检查模型列表
      const checkUrl = `${baseUrl.replace(/\/$/, '')}/api/tags`;
      const modelsResponse = await this.makeHttpRequest(checkUrl, {
        method: 'GET',
        headers: {}
      });
      const modelExists = modelsResponse.models?.some((m: any) => m.name.includes(model));
      if (!modelExists) {
        return false;
      }

      // 最小化 ping 请求
      const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
      const body = JSON.stringify({
        model,
        prompt: 'ping',
        stream: false,
        options: { temperature: 0 }
      });
      const response = await this.makeHttpRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeout: 20000
      });
      return !!(response && (response.response || response.done));
    } catch {
      return false;
    }
  }
}