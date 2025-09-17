export class MarkdownProcessor {
    private codeBlockPattern = /```[\s\S]*?```/g;
    private inlineCodePattern = /`[^`]*?`/g;
    private linkPattern = /\[([^\]]*)\]\([^)]*\)/g;
    private imagePattern = /!\[([^\]]*)\]\([^)]*\)/g;
    private htmlTagPattern = /<[^>]*>/g;
    
    /**
     * 从markdown文本中提取可翻译的内容
     * 过滤掉代码块、内联代码、链接URL等不需要翻译的部分
     */
    public extractTranslatableContent(markdownText: string): string[] {
        // 保存原始文本的映射
        const placeholders = new Map<string, string>();
        let processedText = markdownText;
        let placeholderIndex = 0;
        
        // 替换代码块
        processedText = processedText.replace(this.codeBlockPattern, (match) => {
            const placeholder = `__CODE_BLOCK_${placeholderIndex++}__`;
            placeholders.set(placeholder, match);
            return placeholder;
        });
        
        // 替换内联代码
        processedText = processedText.replace(this.inlineCodePattern, (match) => {
            const placeholder = `__INLINE_CODE_${placeholderIndex++}__`;
            placeholders.set(placeholder, match);
            return placeholder;
        });
        
        // 替换图片（保留alt文本用于翻译）
        processedText = processedText.replace(this.imagePattern, (match, altText) => {
            const placeholder = `__IMAGE_${placeholderIndex++}__`;
            placeholders.set(placeholder, match);
            // 如果有alt文本，单独提取用于翻译
            return altText ? altText : placeholder;
        });
        
        // 替换链接（保留链接文本用于翻译）
        processedText = processedText.replace(this.linkPattern, (match, linkText) => {
            const placeholder = `__LINK_${placeholderIndex++}__`;
            placeholders.set(placeholder, match);
            // 保留链接文本用于翻译
            return linkText;
        });
        
        // 替换HTML标签
        processedText = processedText.replace(this.htmlTagPattern, (match) => {
            const placeholder = `__HTML_TAG_${placeholderIndex++}__`;
            placeholders.set(placeholder, match);
            return placeholder;
        });
        
        // 按行分割并过滤
        const lines = processedText.split('\n');
        const translatableLines: string[] = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 跳过空行
            if (!trimmedLine) {
                translatableLines.push('');
                continue;
            }
            
            // 跳过纯占位符的行
            if (this.isPlaceholderOnly(trimmedLine)) {
                translatableLines.push(line);
                continue;
            }
            
            // 跳过markdown标题标记（但保留标题文本）
            if (trimmedLine.startsWith('#')) {
                const titleText = trimmedLine.replace(/^#+\s*/, '');
                if (titleText && !this.isPlaceholderOnly(titleText)) {
                    translatableLines.push(titleText);
                } else {
                    translatableLines.push(line);
                }
                continue;
            }
            
            // 跳过列表标记（但保留列表文本）
            if (trimmedLine.match(/^[\-\*\+]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
                const listText = trimmedLine.replace(/^([\-\*\+]|\d+\.)\s+/, '');
                if (listText && !this.isPlaceholderOnly(listText)) {
                    translatableLines.push(listText);
                } else {
                    translatableLines.push(line);
                }
                continue;
            }
            
            // 跳过引用标记（但保留引用文本）
            if (trimmedLine.startsWith('>')) {
                const quoteText = trimmedLine.replace(/^>\s*/, '');
                if (quoteText && !this.isPlaceholderOnly(quoteText)) {
                    translatableLines.push(quoteText);
                } else {
                    translatableLines.push(line);
                }
                continue;
            }
            
            // 其他文本行直接添加
            translatableLines.push(trimmedLine);
        }
        
        // 存储映射以供后续重组使用
        this.placeholderMap = placeholders;
        
        return translatableLines;
    }
    
    /**
     * 重新组装翻译后的内容
     */
    public reassembleContent(
        originalText: string,
        extractedContent: string[],
        translatedContent: string[]
    ): string {
        const originalLines = originalText.split('\n');
        const result: string[] = [];
        let translatedIndex = 0;
        
        for (let i = 0; i < originalLines.length; i++) {
            const originalLine = originalLines[i];
            const trimmedLine = originalLine.trim();
            
            if (!trimmedLine) {
                result.push(originalLine);
                translatedIndex++;
                continue;
            }
            
            if (translatedIndex < translatedContent.length) {
                const translatedLine = translatedContent[translatedIndex];
                
                // 处理标题
                if (trimmedLine.startsWith('#')) {
                    const headerPrefix = trimmedLine.match(/^#+\s*/)?.[0] || '';
                    result.push(headerPrefix + translatedLine);
                }
                // 处理列表
                else if (trimmedLine.match(/^[\-\*\+]\s+/) || trimmedLine.match(/^\d+\.\s+/)) {
                    const listPrefix = trimmedLine.match(/^([\-\*\+]|\d+\.)\s+/)?.[0] || '';
                    result.push(listPrefix + translatedLine);
                }
                // 处理引用
                else if (trimmedLine.startsWith('>')) {
                    const quotePrefix = trimmedLine.match(/^>\s*/)?.[0] || '';
                    result.push(quotePrefix + translatedLine);
                }
                // 普通文本
                else {
                    result.push(translatedLine);
                }
            } else {
                result.push(originalLine);
            }
            
            translatedIndex++;
        }
        
        return result.join('\n');
    }
    
    private isPlaceholderOnly(text: string): boolean {
        return /^__[A-Z_]+_\d+__$/.test(text.trim());
    }
    
    private placeholderMap: Map<string, string> = new Map();
    
    /**
     * 检查文本是否包含中文字符
     */
    public containsChinese(text: string): boolean {
        return /[\u4e00-\u9fff]/.test(text);
    }
    
    /**
     * 检查文本是否主要是英文
     */
    public isEnglishText(text: string): boolean {
        const englishPattern = /[a-zA-Z]/g;
        const englishMatches = text.match(englishPattern);
        return englishMatches ? englishMatches.length / text.length > 0.7 : false;
    }
    
    /**
     * 清理文本，去除多余的空白字符
     */
    public cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')  // 多个空白字符替换为单个空格
            .replace(/\n\s*\n/g, '\n\n')  // 多个换行符替换为双换行
            .trim();
    }
}
