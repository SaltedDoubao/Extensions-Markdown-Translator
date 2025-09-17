import axios from 'axios';
import * as vscode from 'vscode';
import { ITranslator } from '../services/translatorService';

export class ClaudeTranslator implements ITranslator {
    private readonly baseURL = 'https://api.anthropic.com/v1/messages';
    
    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('claudeApiKey');
        
        return !!(apiKey && apiKey.trim());
    }
    
    public async translate(text: string, targetLanguage: string): Promise<string> {
        if (!text.trim()) {
            return text;
        }
        
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('claudeApiKey');
        
        if (!apiKey) {
            throw new Error('Claude API密钥未配置，请在设置中配置API密钥');
        }
        
        try {
            const targetLang = this.getLanguageName(targetLanguage);
            const prompt = this.buildTranslationPrompt(text, targetLang);
            
            const response = await axios.post(
                this.baseURL,
                {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 2000,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 30000
                }
            );
            
            if (response.data.content && response.data.content.length > 0) {
                const translatedText = response.data.content[0].text.trim();
                return this.cleanTranslatedText(translatedText);
            }
            
            throw new Error('Claude返回了无效的响应');
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Claude API请求超时');
                } else if (error.response?.status === 401) {
                    throw new Error('Claude API密钥无效或已过期');
                } else if (error.response?.status === 429) {
                    throw new Error('Claude API请求配额已用完或请求过于频繁');
                } else if (error.response?.status === 503) {
                    throw new Error('Claude服务暂时不可用，请稍后再试');
                } else {
                    throw new Error(`Claude API错误: ${error.message}`);
                }
            }
            throw error;
        }
    }
    
    private buildTranslationPrompt(text: string, targetLanguage: string): string {
        return `Please translate the following text to ${targetLanguage}. 

Requirements:
- Only return the translated text without any additional explanations
- Preserve the original meaning and style
- Keep the formatting as close to the original as possible

Text to translate:
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
