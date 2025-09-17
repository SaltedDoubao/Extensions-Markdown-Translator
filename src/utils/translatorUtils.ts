import axios, { AxiosError } from 'axios';

/**
 * 语言代码到语言名称的映射
 */
export function getLanguageName(langCode: string): string {
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

/**
 * 清理翻译后的文本
 */
export function cleanTranslatedText(text: string): string {
    // 移除可能的引号包装
    return text.replace(/^["']|["']$/g, '').trim();
}

/**
 * 统一的axios错误处理
 */
export function handleAxiosError(error: AxiosError, serviceName: string): never {
    if (error.code === 'ECONNABORTED') {
        throw new Error(`${serviceName} API请求超时`);
    } else if (error.response?.status === 401) {
        throw new Error(`${serviceName} API密钥无效或已过期`);
    } else if (error.response?.status === 429) {
        throw new Error(`${serviceName} API请求配额已用完或请求过于频繁`);
    } else if (error.response?.status === 503) {
        throw new Error(`${serviceName}服务暂时不可用，请稍后再试`);
    } else {
        throw new Error(`${serviceName} API错误: ${error.message}`);
    }
}

/**
 * 检查文本是否为空并返回原文本
 */
export function checkEmptyText(text: string): string | null {
    if (!text.trim()) {
        return text;
    }
    return null;
}