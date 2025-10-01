import * as vscode from 'vscode';
import { TranslationEngine } from './baseEngine';
import { GoogleTranslateEngine } from './googleTranslate';
import { MicrosoftTranslateEngine } from './microsoftTranslate';
import { OpenAIEngine } from './openaiEngine';
import { ClaudeEngine } from './claudeEngine';
import { OpenAICompatibleEngine } from './openaiCompatibleEngine';
import { OllamaEngine } from './ollamaEngine';
import { LMStudioEngine } from './lmStudioEngine';
import { GeminiEngine } from './geminiEngine';
import { ZhipuEngine } from './zhipuEngine';
import { XAIEngine } from './xaiEngine';

export type EngineType = 'google' | 'microsoft' | 'openai' | 'claude' | 'gemini' | 'openai-compatible' | 'zhipu' | 'xai' | 'ollama' | 'lm-studio';

export class TranslationEngineManager {
  private engines: Map<EngineType, TranslationEngine> = new Map();

  constructor() {
    this.initializeEngines();
  }

  private initializeEngines() {
    this.engines.set('google', new GoogleTranslateEngine());
    this.engines.set('microsoft', new MicrosoftTranslateEngine());
    this.engines.set('openai', new OpenAIEngine());
    this.engines.set('claude', new ClaudeEngine());
    this.engines.set('gemini', new GeminiEngine());
    this.engines.set('openai-compatible', new OpenAICompatibleEngine());
    this.engines.set('zhipu', new ZhipuEngine());
    this.engines.set('xai', new XAIEngine());
    this.engines.set('ollama', new OllamaEngine());
    this.engines.set('lm-studio', new LMStudioEngine());
  }

  getEngine(type: EngineType): TranslationEngine | undefined {
    return this.engines.get(type);
  }

  getCurrentEngine(): TranslationEngine {
    const config = vscode.workspace.getConfiguration('mdTranslator');
    const engineType = config.get<EngineType>('defaultEngine', 'google');

    const engine = this.getEngine(engineType);
    if (!engine) {
      throw new Error(`Translation engine '${engineType}' not found`);
    }

    return engine;
  }

  getAvailableEngines(): Array<{ type: EngineType; name: string; configured: boolean }> {
    const engines: Array<{ type: EngineType; name: string; configured: boolean }> = [];

    for (const [type, engine] of this.engines) {
      engines.push({
        type,
        name: engine.name,
        configured: engine.isConfigured()
      });
    }

    return engines;
  }

  async validateEngine(type: EngineType): Promise<boolean> {
    const engine = this.getEngine(type);
    if (!engine) {
      return false;
    }

    try {
      return await engine.validateConfig();
    } catch {
      return false;
    }
  }

  getEngineDisplayNames(): Record<EngineType, string> {
    return {
      'google': 'Google Translate',
      'microsoft': 'Microsoft Translator',
      'openai': 'OpenAI GPT',
      'claude': 'Anthropic Claude',
      'gemini': 'Google Gemini',
      'openai-compatible': 'OpenAI Compatible API',
      'zhipu': 'Zhipu AI',
      'xai': 'xAI Grok',
      'ollama': 'Ollama',
      'lm-studio': 'LM Studio'
    };
  }

  getEngineConfigFields(type: EngineType): string[] {
    switch (type) {
      case 'google':
        return ['googleApiKey'];
      case 'microsoft':
        return ['microsoftApiKey', 'microsoftRegion'];
      case 'openai':
        return ['openaiApiKey', 'openaiModel'];
      case 'claude':
        return ['claudeApiKey', 'claudeBaseUrl', 'claudeModel'];
      case 'gemini':
        return ['geminiApiKey', 'geminiModel'];
      case 'openai-compatible':
        return ['openaiCompatibleApiKey', 'openaiCompatibleBaseUrl', 'openaiCompatibleModel'];
      case 'zhipu':
        return ['zhipuApiKey', 'zhipuModel'];
      case 'xai':
        return ['xaiApiKey', 'xaiModel'];
      case 'ollama':
        return ['ollamaBaseUrl', 'ollamaModel'];
      case 'lm-studio':
        return ['lmStudioBaseUrl', 'lmStudioModel'];
      default:
        return [];
    }
  }

  isLLMEngine(type: EngineType): boolean {
    return ['openai', 'claude', 'gemini', 'openai-compatible', 'zhipu', 'xai', 'ollama', 'lm-studio'].includes(type);
  }
}