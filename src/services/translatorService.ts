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
    private abortController: AbortController | null = null;
    private isTranslating: boolean = false;
    
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
        if (this.isTranslating) {
            throw new Error('翻译正在进行中，请等待完成或取消当前翻译');
        }

        this.isTranslating = true;
        this.abortController = new AbortController();

        const concurrencyLimit = 5; // 同时处理的最大请求数
        const results: string[] = new Array(texts.length);
        const tasks: { text: string, index: number }[] = [];

        try {
            // 收集需要翻译的任务
            for (let i = 0; i < texts.length; i++) {
                if (this.abortController.signal.aborted) {
                    throw new Error('翻译已被取消');
                }

                if (texts[i].trim()) {
                    tasks.push({ text: texts[i], index: i });
                } else {
                    results[i] = texts[i]; // 空文本直接保留
                }
            }

            // 如果没有需要翻译的任务，直接返回
            if (tasks.length === 0) {
                return results;
            }

            // 并发处理任务
            const executeTask = async (task: { text: string, index: number }) => {
                if (this.abortController?.signal.aborted) {
                    throw new Error('翻译已被取消');
                }

                try {
                    const translated = await this.translate(task.text, targetLanguage);
                    if (!this.abortController?.signal.aborted) {
                        results[task.index] = translated;
                    }
                } catch (error) {
                    if (this.abortController?.signal.aborted) {
                        throw new Error('翻译已被取消');
                    }
                    console.error(`翻译失败: ${task.text}`, error);
                    results[task.index] = task.text; // 失败时保留原文
                }
            };

            // 使用并发控制处理所有任务
            const taskQueue = [...tasks];
            const workers: Promise<void>[] = [];

            for (let i = 0; i < Math.min(concurrencyLimit, taskQueue.length); i++) {
                workers.push(
                    (async () => {
                        while (taskQueue.length > 0 && !this.abortController?.signal.aborted) {
                            const task = taskQueue.shift();
                            if (task) {
                                await executeTask(task);
                                // 在请求之间添加小延迟，避免API频率限制
                                if (!this.abortController?.signal.aborted) {
                                    await this.sleep(50);
                                }
                            }
                        }
                    })()
                );
            }

            await Promise.all(workers);

            if (this.abortController.signal.aborted) {
                throw new Error('翻译已被取消');
            }

            return results;

        } finally {
            this.isTranslating = false;
            this.abortController = null;
        }
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

    /**
     * 中止当前翻译任务
     */
    public abortTranslation(): void {
        if (this.abortController && this.isTranslating) {
            this.abortController.abort();
            console.log('翻译任务已被中止');
        }
    }

    /**
     * 检查是否正在翻译
     */
    public getIsTranslating(): boolean {
        return this.isTranslating;
    }
}
