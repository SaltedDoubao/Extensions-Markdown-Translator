import { BaseTranslationEngine, TranslationConfig } from './baseEngine';

export abstract class BaseLLMEngine extends BaseTranslationEngine {

  protected getTranslationPrompt(text: string, targetLanguage: string, sourceLanguage?: string): string {
    const targetLangName = this.getLanguageName(targetLanguage);
    const sourceLangName = sourceLanguage ? this.getLanguageName(sourceLanguage) : 'auto-detected language';

    return `You are a professional translator. Please translate the following text from ${sourceLangName} to ${targetLangName}.

IMPORTANT INSTRUCTIONS:
1. Translate ONLY the content, do not add any explanations, comments, or additional text
2. Preserve all markdown formatting (links, bold, italic, code blocks, etc.)
3. Do not translate code blocks, code snippets, URLs, or technical terms that should remain in English
4. Keep the same paragraph structure and line breaks
5. For technical documentation, maintain consistency in terminology
6. Return only the translated text without any wrapper or explanation

Text to translate:
${text}

Translation:`;
  }

  protected getLanguageName(langCode: string): string {
    const langNames: { [key: string]: string } = {
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'en': 'English',
      'ja': 'Japanese',
      'ko': 'Korean',
      'fr': 'French',
      'de': 'German',
      'es': 'Spanish',
      'ru': 'Russian',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'pt': 'Portuguese',
      'it': 'Italian'
    };
    return langNames[langCode] || langCode;
  }

  protected cleanLLMResponse(response: string): string {
    // 移除常见的LLM回复前缀/后缀
    let cleaned = response
      .replace(/^(Translation:|Translated text:|Here's the translation:)/i, '')
      .replace(/^```[\w]*\n/, '')
      .replace(/\n```$/, '')
      .trim();

    // 移除多余的引号
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }

    return cleaned;
  }

  protected preprocessText(text: string): string {
    // 对于LLM，我们可以稍微简化文本以获得更好的翻译结果
    // 但要保持markdown结构
    return text;
  }
}