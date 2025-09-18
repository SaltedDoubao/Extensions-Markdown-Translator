export interface ExtractResult {
    translatableLines: string[];
    placeholderMap: Map<string, string>;
    lineStructure: LineInfo[];
}

export interface LineInfo {
    originalLine: string;
    type: 'empty' | 'placeholder_only' | 'header' | 'list' | 'quote' | 'normal';
    prefix?: string;
    content?: string;
}

export class MarkdownProcessor {
    private codeBlockPattern = /```[\s\S]*?```/g;
    private inlineCodePattern = /`[^`]*?`/g;
    private linkPattern = /\[([^\]]*)\]\(([^)]*)\)/g;
    private imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
    private htmlTagPattern = /<[^>]*>/g;

    /**
     * 从markdown文本中提取可翻译的内容
     * 过滤掉代码块、内联代码、链接URL等不需要翻译的部分
     */
    public extractTranslatableContent(markdownText: string): ExtractResult {
        // 保存原始文本的映射
        const placeholderMap = new Map<string, string>();
        let processedText = markdownText;
        let placeholderIndex = 0;

        // 替换代码块
        processedText = processedText.replace(this.codeBlockPattern, (match) => {
            const placeholder = `__CODE_BLOCK_${placeholderIndex++}__`;
            placeholderMap.set(placeholder, match);
            return placeholder;
        });

        // 替换内联代码
        processedText = processedText.replace(this.inlineCodePattern, (match) => {
            const placeholder = `__INLINE_CODE_${placeholderIndex++}__`;
            placeholderMap.set(placeholder, match);
            return placeholder;
        });

        // 替换图片（保留alt文本用于翻译，保持图片格式）
        processedText = processedText.replace(this.imagePattern, (match, altText, url) => {
            const urlPlaceholder = `__IMG_URL_${placeholderIndex++}__`;
            placeholderMap.set(urlPlaceholder, url);

            // 如果有alt文本，创建可翻译的alt文本占位符，但保持图片格式
            if (altText && altText.trim()) {
                const altPlaceholder = `__IMG_ALT_${placeholderIndex++}__`;
                placeholderMap.set(altPlaceholder, altText);
                return `![${altPlaceholder}](${urlPlaceholder})`;
            } else {
                // 没有alt文本的图片
                const placeholder = `__IMAGE_${placeholderIndex++}__`;
                placeholderMap.set(placeholder, match);
                return placeholder;
            }
        });

        // 替换链接（保留链接文本用于翻译，保持链接结构）
        processedText = processedText.replace(this.linkPattern, (match, linkText, url) => {
            const urlPlaceholder = `__LINK_URL_${placeholderIndex++}__`;
            placeholderMap.set(urlPlaceholder, url);

            // 如果链接文本不为空且不是URL，则创建可翻译的链接文本占位符
            if (linkText && linkText.trim() && !this.isUrl(linkText)) {
                const textPlaceholder = `__LINK_TEXT_${placeholderIndex++}__`;
                placeholderMap.set(textPlaceholder, linkText);
                return `[${textPlaceholder}](${urlPlaceholder})`;
            } else {
                // 如果链接文本是URL或为空，保持原样不翻译
                const placeholder = `__LINK_${placeholderIndex++}__`;
                placeholderMap.set(placeholder, match);
                return placeholder;
            }
        });

        // 替换HTML标签
        processedText = processedText.replace(this.htmlTagPattern, (match) => {
            const placeholder = `__HTML_TAG_${placeholderIndex++}__`;
            placeholderMap.set(placeholder, match);
            return placeholder;
        });

        // 按行分割并分析结构
        const lines = processedText.split('\n');
        const translatableLines: string[] = [];
        const lineStructure: LineInfo[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();

            // 空行
            if (!trimmedLine) {
                translatableLines.push('');
                lineStructure.push({
                    originalLine: line,
                    type: 'empty'
                });
                continue;
            }

            // 纯占位符的行
            if (this.isPlaceholderOnly(trimmedLine)) {
                translatableLines.push(line);
                lineStructure.push({
                    originalLine: line,
                    type: 'placeholder_only'
                });
                continue;
            }

            // 标题
            if (trimmedLine.startsWith('#')) {
                const headerMatch = trimmedLine.match(/^(#+\s*)(.*)/);
                if (headerMatch) {
                    const prefix = headerMatch[1];
                    const titleText = headerMatch[2];
                    if (titleText && !this.isPlaceholderOnly(titleText)) {
                        translatableLines.push(titleText);
                        lineStructure.push({
                            originalLine: line,
                            type: 'header',
                            prefix: prefix,
                            content: titleText
                        });
                    } else {
                        translatableLines.push(line);
                        lineStructure.push({
                            originalLine: line,
                            type: 'placeholder_only'
                        });
                    }
                }
                continue;
            }

            // 列表
            const listMatch = trimmedLine.match(/^([\-\*\+]|\d+\.)\s+(.*)/);
            if (listMatch) {
                const prefix = listMatch[1] + ' ';
                const listText = listMatch[2];
                if (listText && !this.isPlaceholderOnly(listText)) {
                    translatableLines.push(listText);
                    lineStructure.push({
                        originalLine: line,
                        type: 'list',
                        prefix: prefix,
                        content: listText
                    });
                } else {
                    translatableLines.push(line);
                    lineStructure.push({
                        originalLine: line,
                        type: 'placeholder_only'
                    });
                }
                continue;
            }

            // 引用
            const quoteMatch = trimmedLine.match(/^(>\s*)(.*)/);
            if (quoteMatch) {
                const prefix = quoteMatch[1];
                const quoteText = quoteMatch[2];
                if (quoteText && !this.isPlaceholderOnly(quoteText)) {
                    translatableLines.push(quoteText);
                    lineStructure.push({
                        originalLine: line,
                        type: 'quote',
                        prefix: prefix,
                        content: quoteText
                    });
                } else {
                    translatableLines.push(line);
                    lineStructure.push({
                        originalLine: line,
                        type: 'placeholder_only'
                    });
                }
                continue;
            }

            // 普通文本行
            translatableLines.push(trimmedLine);
            lineStructure.push({
                originalLine: line,
                type: 'normal',
                content: trimmedLine
            });
        }

        return {
            translatableLines,
            placeholderMap,
            lineStructure
        };
    }
    
    /**
     * 重新组装翻译后的内容
     */
    public reassembleContent(
        lineStructure: LineInfo[],
        translatedContent: string[],
        placeholderMap: Map<string, string>
    ): string {
        const result: string[] = [];
        let translatedIndex = 0;

        for (const lineInfo of lineStructure) {
            switch (lineInfo.type) {
                case 'empty':
                    result.push(lineInfo.originalLine);
                    translatedIndex++;
                    break;

                case 'placeholder_only':
                    // 恢复占位符内容
                    const restoredLine = this.restorePlaceholders(lineInfo.originalLine, placeholderMap);
                    result.push(restoredLine);
                    translatedIndex++;
                    break;

                case 'header':
                    if (translatedIndex < translatedContent.length) {
                        const translatedText = this.restorePlaceholders(translatedContent[translatedIndex], placeholderMap);
                        result.push((lineInfo.prefix || '') + translatedText);
                    } else {
                        result.push(lineInfo.originalLine);
                    }
                    translatedIndex++;
                    break;

                case 'list':
                    if (translatedIndex < translatedContent.length) {
                        const translatedText = this.restorePlaceholders(translatedContent[translatedIndex], placeholderMap);
                        result.push((lineInfo.prefix || '') + translatedText);
                    } else {
                        result.push(lineInfo.originalLine);
                    }
                    translatedIndex++;
                    break;

                case 'quote':
                    if (translatedIndex < translatedContent.length) {
                        const translatedText = this.restorePlaceholders(translatedContent[translatedIndex], placeholderMap);
                        result.push((lineInfo.prefix || '') + translatedText);
                    } else {
                        result.push(lineInfo.originalLine);
                    }
                    translatedIndex++;
                    break;

                case 'normal':
                    if (translatedIndex < translatedContent.length) {
                        const translatedText = this.restorePlaceholders(translatedContent[translatedIndex], placeholderMap);
                        result.push(translatedText);
                    } else {
                        result.push(lineInfo.originalLine);
                    }
                    translatedIndex++;
                    break;

                default:
                    result.push(lineInfo.originalLine);
                    translatedIndex++;
                    break;
            }
        }

        return result.join('\n');
    }

    /**
     * 恢复文本中的占位符
     */
    private restorePlaceholders(text: string, placeholderMap: Map<string, string>): string {
        let restoredText = text;

        // 按占位符类型的优先级恢复（从最具体到最一般）
        const placeholderPatterns = [
            /__CODE_BLOCK_\d+__/g,
            /__INLINE_CODE_\d+__/g,
            /__IMG_ALT_\d+__/g,
            /__IMG_URL_\d+__/g,
            /__LINK_TEXT_\d+__/g,
            /__LINK_URL_\d+__/g,
            /__IMAGE_\d+__/g,
            /__LINK_\d+__/g,
            /__HTML_TAG_\d+__/g
        ];

        for (const pattern of placeholderPatterns) {
            restoredText = restoredText.replace(pattern, (match) => {
                return placeholderMap.get(match) || match;
            });
        }

        return restoredText;
    }
    
    private isPlaceholderOnly(text: string): boolean {
        // 检查是否为各种类型的占位符
        const placeholderPatterns = [
            /^__CODE_BLOCK_\d+__$/,
            /^__INLINE_CODE_\d+__$/,
            /^__IMAGE_\d+__$/,
            /^__LINK_\d+__$/,
            /^__HTML_TAG_\d+__$/,
            /^__IMG_ALT_\d+__$/,
            /^__LINK_TEXT_\d+__$/,
            /^__LINK_URL_\d+__$/
        ];

        const trimmedText = text.trim();
        return placeholderPatterns.some(pattern => pattern.test(trimmedText));
    }

    /**
     * 检查文本是否是URL
     */
    private isUrl(text: string): boolean {
        try {
            // 检查是否是完整的URL
            new URL(text);
            return true;
        } catch {
            // 检查是否是相对路径或其他URL形式
            return /^(https?:\/\/|mailto:|tel:|#|\.\.?\/|\/)/i.test(text);
        }
    }
    
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
