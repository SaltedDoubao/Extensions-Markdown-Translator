import axios from 'axios';
import * as crypto from 'crypto-js';
import * as vscode from 'vscode';
import { ITranslator } from '../services/translatorService';

export class BaiduTranslator implements ITranslator {
    private readonly baseURL = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
    
    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const appId = config.get<string>('baiduAppId');
        const secretKey = config.get<string>('baiduSecretKey');
        
        return !!(appId && secretKey);
    }
    
    public async translate(text: string, targetLanguage: string): Promise<string> {
        if (!text.trim()) {
            return text;
        }
        
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const appId = config.get<string>('baiduAppId');
        const secretKey = config.get<string>('baiduSecretKey');
        
        if (!appId || !secretKey) {
            throw new Error('百度翻译API配置不完整，请在设置中配置APP ID和密钥');
        }
        
        try {
            const salt = Date.now().toString();
            const sourceLanguage = this.detectSourceLanguage(targetLanguage);
            const sign = this.generateSign(text, appId, salt, secretKey);
            
            const response = await axios.post(this.baseURL, null, {
                params: {
                    q: text,
                    from: this.normalizeLanguageCode(sourceLanguage),
                    to: this.normalizeLanguageCode(targetLanguage),
                    appid: appId,
                    salt: salt,
                    sign: sign
                },
                timeout: 15000
            });
            
            if (response.data.error_code) {
                throw new Error(`百度翻译API错误 ${response.data.error_code}: ${this.getErrorMessage(response.data.error_code)}`);
            }
            
            if (response.data.trans_result && response.data.trans_result.length > 0) {
                return response.data.trans_result[0].dst;
            }
            
            throw new Error('百度翻译返回了无效的响应');
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    throw new Error('百度翻译请求超时');
                } else if (error.response?.status === 429) {
                    throw new Error('百度翻译API请求过于频繁，请稍后再试');
                } else {
                    throw new Error(`百度翻译API错误: ${error.message}`);
                }
            }
            throw error;
        }
    }
    
    private generateSign(query: string, appId: string, salt: string, secretKey: string): string {
        const str = appId + query + salt + secretKey;
        return crypto.MD5(str).toString();
    }
    
    private detectSourceLanguage(targetLanguage: string): string {
        return targetLanguage === 'zh' ? 'en' : 'zh';
    }
    
    private normalizeLanguageCode(langCode: string): string {
        const languageMap: { [key: string]: string } = {
            'zh': 'zh',
            'en': 'en',
            'ja': 'jp',
            'ko': 'kor',
            'fr': 'fra',
            'de': 'de',
            'es': 'spa',
            'ru': 'ru'
        };
        
        return languageMap[langCode] || langCode;
    }
    
    private getErrorMessage(errorCode: string): string {
        const errorMessages: { [key: string]: string } = {
            '52001': '请求超时',
            '52002': '系统错误',
            '52003': '未授权用户',
            '54000': '必填参数为空',
            '54001': '签名错误',
            '54003': '访问频率受限',
            '54004': '账户余额不足',
            '54005': '长query请求频繁',
            '58000': '客户端IP非法',
            '58001': '译文语言方向不支持',
            '58002': '服务当前已关闭',
            '90107': '认证未通过或未生效'
        };
        
        return errorMessages[errorCode] || '未知错误';
    }
}
