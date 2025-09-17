import axios from 'axios';
import * as vscode from 'vscode';
import { ITranslator } from '../services/translatorService';

export class OpenAITranslator implements ITranslator {
    private readonly baseURL = 'https://api.openai.com/v1/chat/completions';
    
    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('openaiApiKey');
        
        return !!(apiKey && apiKey.trim());
    }
    
    public async translate(text: string, targetLanguage: string): Promise<string> {
        if (!text.trim()) {
            return text;
        }
        
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('openaiApiKey');
        
        if (!apiKey) {
            throw new Error('OpenAI API密钥未配置，请在设置中配置API密钥');
        }
        
        try {
            const targetLang = this.getLanguageName(targetLanguage);
            const prompt = this.buildTranslationPrompt(text, targetLang);
            
            const response = await axios.post(
                this.baseURL,
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional translator. Please translate the given text accurately while preserving the original meaning and style.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.3
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            if (response.data.choices && response.data.choices.length > 0) {
                const translatedText = response.data.choices[0].message.content.trim();
                return this.cleanTranslatedText(translatedText);
            }
            
            throw new Error('OpenAI返回了无效的响应');
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('OpenAI API请求超时');
                } else if (error.response?.status === 401) {
                    throw new Error('OpenAI API密钥无效或已过期');
                } else if (error.response?.status === 429) {
                    throw new Error('OpenAI API请求配额已用完或请求过于频繁');
                } else if (error.response?.status === 503) {
                    throw new Error('OpenAI服务暂时不可用，请稍后再试');
                } else {
                    throw new Error(`OpenAI API错误: ${error.message}`);
                }
            }
            throw error;
        }
    }
    
    private buildTranslationPrompt(text: string, targetLanguage: string): string {
        return `Please translate the following text to ${targetLanguage}. Only return the translated text without any additional explanations or formatting:

${text}`;
    }
    
    private getLanguageName(langCode: string): string {
        const languageMap: { [key: string]: string } = {
            'zh': 'Chinese (Simplified)',
            'en': 'English',
            'ja': 'Japanese',
            'ko': 'Korean',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'ru': 'Russian'
        };
        
        return languageMap[langCode] || 'English';
    }
    
    private cleanTranslatedText(text: string): string {
        // 移除可能的引号包装
        return text.replace(/^["']|["']$/g, '').trim();
    }
}
