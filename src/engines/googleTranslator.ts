import axios from 'axios';
import { ITranslator } from '../services/translatorService';

export class GoogleTranslator implements ITranslator {
    private readonly baseURL = 'https://translate.googleapis.com/translate_a/single';
    
    public isConfigured(): boolean {
        // Google翻译使用免费API，无需配置
        return true;
    }
    
    public async translate(text: string, targetLanguage: string): Promise<string> {
        if (!text.trim()) {
            return text;
        }
        
        try {
            const sourceLanguage = this.detectSourceLanguage(targetLanguage);
            
            const response = await axios.get(this.baseURL, {
                params: {
                    client: 'gtx',
                    sl: sourceLanguage,
                    tl: this.normalizeLanguageCode(targetLanguage),
                    dt: 't',
                    q: text
                },
                timeout: 10000
            });
            
            if (response.data && response.data[0] && response.data[0][0]) {
                return response.data[0][0][0];
            }
            
            throw new Error('Google翻译返回了无效的响应');
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('Google翻译请求超时');
                } else if (error.response?.status === 429) {
                    throw new Error('Google翻译API请求过于频繁，请稍后再试');
                } else {
                    throw new Error(`Google翻译API错误: ${error.message}`);
                }
            }
            throw error;
        }
    }
    
    private detectSourceLanguage(targetLanguage: string): string {
        // 简单的源语言检测逻辑
        return targetLanguage === 'zh' ? 'en' : 'zh';
    }
    
    private normalizeLanguageCode(langCode: string): string {
        const languageMap: { [key: string]: string } = {
            'zh': 'zh-cn',
            'en': 'en',
            'ja': 'ja',
            'ko': 'ko',
            'fr': 'fr',
            'de': 'de',
            'es': 'es',
            'ru': 'ru'
        };
        
        return languageMap[langCode] || langCode;
    }
}
