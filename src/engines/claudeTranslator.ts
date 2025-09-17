import axios from 'axios';
import * as vscode from 'vscode';
import { ITranslator } from '../services/translatorService';
import { getLanguageName, cleanTranslatedText, handleAxiosError, checkEmptyText } from '../utils/translatorUtils';

export class ClaudeTranslator implements ITranslator {
    private readonly baseURL = 'https://api.anthropic.com/v1/messages';

    public isConfigured(): boolean {
        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('claudeApiKey');

        return !!(apiKey && apiKey.trim());
    }

    public async translate(text: string, targetLanguage: string): Promise<string> {
        const emptyCheck = checkEmptyText(text);
        if (emptyCheck !== null) {
            return emptyCheck;
        }

        const config = vscode.workspace.getConfiguration('markdownTranslator');
        const apiKey = config.get<string>('claudeApiKey');
        const model = config.get<string>('claudeModel', 'claude-3-haiku-20240307');

        if (!apiKey) {
            throw new Error('Claude API密钥未配置，请在设置中配置API密钥');
        }

        try {
            const targetLang = getLanguageName(targetLanguage);
            const prompt = this.buildTranslationPrompt(text, targetLang);

            const response = await axios.post(
                this.baseURL,
                {
                    model: model,
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
                return cleanTranslatedText(translatedText);
            }

            throw new Error('Claude返回了无效的响应');

        } catch (error) {
            if (axios.isAxiosError(error)) {
                handleAxiosError(error, 'Claude');
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
}
