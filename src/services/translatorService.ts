import * as vscode from 'vscode';
import { GoogleTranslator } from '../engines/googleTranslator';
import { BaiduTranslator } from '../engines/baiduTranslator';
import { OpenAITranslator } from '../engines/openaiTranslator';
import { ClaudeTranslator } from '../engines/claudeTranslator';

export interface ITranslator {
    translate(text: string, targetLanguage: string): Promise<string>;
    isConfigured(): boolean;
}

export class TranslatorService {
    private translators: Map<string, ITranslator>;
    private currentEngine: string = 'google';
    
    constructor() {
        this.translators = new Map();
        this.initializeTranslators();
        this.updateConfiguration();
    }
    
    private initializeTranslators() {
        this.translators.set('google', new GoogleTranslator());
        this.translators.set('baidu', new BaiduTranslator());
        this.translators.set('openai', new OpenAITranslator());
        this.translators.set('claude', new ClaudeTranslator());
    }
    
    public updateConfiguration() {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        this.currentEngine = config.get<string>('defaultEngine', 'google');
    }
    
    public async translate(text: string, targetLanguage: string): Promise<string> {
        const translator = this.getTranslator();
        
        if (!translator.isConfigured()) {
            throw new Error(`${this.currentEngine} 翻译引擎未正确配置，请检查设置`);
        }
        
        return await translator.translate(text, targetLanguage);
    }
    
    public async translateBatch(texts: string[], targetLanguage: string): Promise<string[]> {
        const results: string[] = [];
        
        for (const text of texts) {
            if (text.trim()) {
                try {
                    const translated = await this.translate(text, targetLanguage);
                    results.push(translated);
                    
                    // 添加小延迟，避免API频率限制
                    await this.sleep(100);
                } catch (error) {
                    console.error(`翻译失败: ${text}`, error);
                    results.push(text); // 翻译失败时保持原文
                }
            } else {
                results.push(text);
            }
        }
        
        return results;
    }
    
    private getTranslator(): ITranslator {
        const translator = this.translators.get(this.currentEngine);
        if (!translator) {
            throw new Error(`不支持的翻译引擎: ${this.currentEngine}`);
        }
        return translator;
    }
    
    public getAvailableEngines(): string[] {
        return Array.from(this.translators.keys());
    }
    
    public setEngine(engine: string): boolean {
        if (this.translators.has(engine)) {
            this.currentEngine = engine;
            return true;
        }
        return false;
    }
    
    public getCurrentEngine(): string {
        return this.currentEngine;
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
