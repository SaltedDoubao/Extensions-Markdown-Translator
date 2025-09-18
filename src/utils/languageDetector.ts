/**
 * 语言检测和处理工具
 */
export class LanguageDetector {
    /**
     * 检测文本的主要语言
     */
    public detectLanguage(text: string): string {
        if (!text || text.trim().length === 0) {
            return 'unknown';
        }

        // 移除代码块和其他不相关内容
        const cleanText = this.cleanTextForDetection(text);

        // 语言特征检测
        const features = this.extractLanguageFeatures(cleanText);

        // 根据特征判断语言
        return this.classifyLanguage(features);
    }

    /**
     * 检测语言并获取合适的目标语言，避免原文与目标语言一致
     */
    public detectAndGetTargetLanguage(text: string, defaultTarget: string = 'zh'): string {
        const detectedLanguage = this.detectLanguage(text);

        // 如果检测到的语言与默认目标语言一致，选择替代语言
        if (this.normalizeLanguageCode(detectedLanguage) === this.normalizeLanguageCode(defaultTarget)) {
            return this.getAlternativeTargetLanguage(detectedLanguage);
        }

        return defaultTarget;
    }

    /**
     * 清理文本，移除代码块、链接等干扰内容
     */
    private cleanTextForDetection(text: string): string {
        let cleanText = text;

        // 移除代码块
        cleanText = cleanText.replace(/```[\s\S]*?```/g, '');

        // 移除内联代码
        cleanText = cleanText.replace(/`[^`]*?`/g, '');

        // 移除链接
        cleanText = cleanText.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

        // 移除图片
        cleanText = cleanText.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

        // 移除HTML标签
        cleanText = cleanText.replace(/<[^>]*>/g, '');

        // 移除Markdown标记
        cleanText = cleanText.replace(/^#+\s*/gm, '');
        cleanText = cleanText.replace(/^\*\s*/gm, '');
        cleanText = cleanText.replace(/^-\s*/gm, '');
        cleanText = cleanText.replace(/^\d+\.\s*/gm, '');
        cleanText = cleanText.replace(/^>\s*/gm, '');

        return cleanText.trim();
    }

    /**
     * 提取语言特征
     */
    private extractLanguageFeatures(text: string): LanguageFeatures {
        const totalChars = text.length;
        if (totalChars === 0) {
            return {
                chinese: 0,
                japanese: 0,
                korean: 0,
                english: 0,
                cyrillic: 0,
                arabic: 0,
                latin: 0
            };
        }

        return {
            chinese: this.countMatches(text, /[\u4e00-\u9fff]/g) / totalChars,
            japanese: this.countMatches(text, /[\u3040-\u309f\u30a0-\u30ff]/g) / totalChars,
            korean: this.countMatches(text, /[\uac00-\ud7af]/g) / totalChars,
            english: this.countMatches(text, /[a-zA-Z]/g) / totalChars,
            cyrillic: this.countMatches(text, /[\u0400-\u04ff]/g) / totalChars,
            arabic: this.countMatches(text, /[\u0600-\u06ff]/g) / totalChars,
            latin: this.countMatches(text, /[a-zA-ZÀ-ÿ]/g) / totalChars
        };
    }

    /**
     * 计算匹配数量
     */
    private countMatches(text: string, regex: RegExp): number {
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }

    /**
     * 根据特征分类语言
     */
    private classifyLanguage(features: LanguageFeatures): string {
        const threshold = 0.1; // 10%的阈值

        // 中文检测
        if (features.chinese > threshold) {
            return 'zh';
        }

        // 日文检测
        if (features.japanese > threshold) {
            return 'ja';
        }

        // 韩文检测
        if (features.korean > threshold) {
            return 'ko';
        }

        // 俄文检测
        if (features.cyrillic > threshold) {
            return 'ru';
        }

        // 阿拉伯文检测
        if (features.arabic > threshold) {
            return 'ar';
        }

        // 英文检测（拉丁字母为主且英文字母占比高）
        if (features.english > 0.6 && features.latin > 0.7) {
            return 'en';
        }

        // 其他拉丁语系语言
        if (features.latin > 0.7) {
            return this.detectLatinLanguage(features);
        }

        // 默认返回英文
        return 'en';
    }

    /**
     * 检测拉丁语系的具体语言
     */
    private detectLatinLanguage(features: LanguageFeatures): string {
        // 简单的拉丁语系检测，可以根据需要扩展
        return 'en'; // 默认英文
    }

    /**
     * 标准化语言代码
     */
    private normalizeLanguageCode(langCode: string): string {
        const normalized: { [key: string]: string } = {
            'zh': 'zh',
            'zh-CN': 'zh',
            'zh-cn': 'zh',
            'chinese': 'zh',
            'en': 'en',
            'english': 'en',
            'ja': 'ja',
            'japanese': 'ja',
            'ko': 'ko',
            'korean': 'ko',
            'fr': 'fr',
            'french': 'fr',
            'de': 'de',
            'german': 'de',
            'es': 'es',
            'spanish': 'es',
            'ru': 'ru',
            'russian': 'ru'
        };

        return normalized[langCode.toLowerCase()] || langCode.toLowerCase();
    }

    /**
     * 获取替代目标语言
     */
    private getAlternativeTargetLanguage(detectedLanguage: string): string {
        const alternatives: { [key: string]: string } = {
            'zh': 'en',    // 中文 -> 英文
            'en': 'zh',    // 英文 -> 中文
            'ja': 'en',    // 日文 -> 英文
            'ko': 'en',    // 韩文 -> 英文
            'fr': 'en',    // 法文 -> 英文
            'de': 'en',    // 德文 -> 英文
            'es': 'en',    // 西班牙文 -> 英文
            'ru': 'en'     // 俄文 -> 英文
        };

        return alternatives[detectedLanguage] || 'en';
    }

    /**
     * 检查两种语言是否实质相同
     */
    public isSameLanguage(lang1: string, lang2: string): boolean {
        return this.normalizeLanguageCode(lang1) === this.normalizeLanguageCode(lang2);
    }
}

interface LanguageFeatures {
    chinese: number;
    japanese: number;
    korean: number;
    english: number;
    cyrillic: number;
    arabic: number;
    latin: number;
}