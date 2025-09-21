import * as vscode from 'vscode';
import { TranslationEngineManager } from './engines/engineManager';

export class ApiClient {
  private ongoingRequest: any = null;
  private engineManager: TranslationEngineManager;

  constructor(private context: vscode.ExtensionContext) {
    this.engineManager = new TranslationEngineManager();
  }

  cancelOngoing() {
    if (this.ongoingRequest) {
      this.ongoingRequest.destroy();
      this.ongoingRequest = null;
    }
  }

  async translate(text: string, targetLang: string): Promise<string> {
    try {
      const engine = this.engineManager.getCurrentEngine();

      if (!engine.isConfigured()) {
        throw new Error(`${engine.name} is not properly configured. Please check your settings.`);
      }

      const result = await engine.translate(text, { targetLanguage: targetLang });
      return result;
    } catch (error) {
      throw new Error(`Translation failed: ${error}`);
    }
  }

  async validateCurrentEngine(): Promise<boolean> {
    try {
      const engine = this.engineManager.getCurrentEngine();
      return await engine.validateConfig();
    } catch {
      return false;
    }
  }

  getAvailableEngines() {
    return this.engineManager.getAvailableEngines();
  }

  getEngineDisplayNames() {
    return this.engineManager.getEngineDisplayNames();
  }
}