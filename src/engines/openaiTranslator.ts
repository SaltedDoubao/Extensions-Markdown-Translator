import axios from 'axios';
import * as vscode from 'vscode';
import { ITranslator } from '../services/translatorService';
import { getLanguageName, cleanTranslatedText, handleAxiosError, checkEmptyText } from '../utils/translatorUtils';

export class OpenAITranslator implements ITranslator {
    private readonly baseURL = 'https://api.openai.com/v1/chat/completions';

    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('openaiApiKey');

        return !!(apiKey && apiKey.trim());
    }

    public async translate(text: string, targetLanguage: string): Promise<string> {
        const emptyCheck = checkEmptyText(text);
        if (emptyCheck !== null) {
            return emptyCheck;
        }

        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('openaiApiKey');
        const model = config.get<string>('openaiModel', 'gpt-3.5-turbo');

        if (!apiKey) {
            throw new Error('OpenAI API密钥未配置，请在设置中配置API密钥');
        }

        try {
            const targetLang = getLanguageName(targetLanguage);
            const prompt = this.buildTranslationPrompt(text, targetLang);

            const response = await axios.post(
                this.baseURL,
                {
                    model: model,
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
                return cleanTranslatedText(translatedText);
            }

            throw new Error('OpenAI返回了无效的响应');

        } catch (error) {
            if (axios.isAxiosError(error)) {
                handleAxiosError(error, 'OpenAI');
            }
            throw error;
        }
    }

    private buildTranslationPrompt(text: string, targetLanguage: string): string {
        return `Please translate the following text to ${targetLanguage}. Only return the translated text without any additional explanations or formatting:

${text}`;
    }
}
