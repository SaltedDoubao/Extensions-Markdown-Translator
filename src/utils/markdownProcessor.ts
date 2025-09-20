export interface ExtractResult {
    translatableLines: string[];
    placeholderMap: Map<string, string>;
    lineStructure: LineInfo[];
}

export interface LineInfo {
    originalLine: string;
    type: 'empty' | 'placeholder_only' | 'header' | 'list' | 'quote' | 'table_row' | 'table_separator' | 'code_block' | 'normal';
    prefix?: string;
    content?: string;
    tableData?: TableCellData[];
}

export interface TableCellData {
    originalContent: string;
    translatableContent?: string;
    isTranslatable: boolean;
}

export class MarkdownProcessor {
    private codeBlockPattern = /```[\s\S]*?```/g;
    private inlineCodePattern = /`[^`]*?`/g;
    private linkPattern = /\[([^\]]*)\]\(([^)]*)\)/g;
    private imagePattern = /!\[([^\]]*)\]\(([^)]*)\)/g;
    private htmlTagPattern = /<[^>]*>/g;
    private tableRowPattern = /^\s*\|.*\|\s*$/;
    private tableSeparatorPattern = /^\s*\|[\s\-\:\|]*\|\s*$/;
    private codeBlockStartPattern = /^\s*```/;

    /**
     * 从markdown文本中提取可翻译的内容
     * 过滤掉代码块、内联代码、链接URL等不需要翻译的部分
     */
    public extractTranslatableContent(markdownText: string): ExtractResult {
        const placeholderMap = new Map<string, string>();
        let placeholderIndex = 0;

        // 首先处理代码块（按行处理以便更好地控制结构）
        const lines = markdownText.split('\n');
        const processedLines: string[] = [];
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检查代码块开始/结束
            if (this.codeBlockStartPattern.test(line)) {
                inCodeBlock = !inCodeBlock;
                const placeholder = this.generateSafePlaceholder('CODE_BLOCK_LINE', placeholderIndex++);
                placeholderMap.set(placeholder, line);
                processedLines.push(placeholder);
                continue;
            }

            // 代码块内的行
            if (inCodeBlock) {
                const placeholder = this.generateSafePlaceholder('CODE_BLOCK_LINE', placeholderIndex++);
                placeholderMap.set(placeholder, line);
                processedLines.push(placeholder);
                continue;
            }

            processedLines.push(line);
        }

        let processedText = processedLines.join('\n');

        // 替换内联代码
        processedText = processedText.replace(this.inlineCodePattern, (match) => {
            const placeholder = this.generateSafePlaceholder('INLINE_CODE', placeholderIndex++);
            placeholderMap.set(placeholder, match);
            return placeholder;
        });

        // 替换图片（保留alt文本用于翻译）
        processedText = processedText.replace(this.imagePattern, (match, altText, url) => {
            const urlPlaceholder = this.generateSafePlaceholder('IMG_URL', placeholderIndex++);
            placeholderMap.set(urlPlaceholder, url);

            if (altText && altText.trim()) {
                const altPlaceholder = this.generateSafePlaceholder('IMG_ALT', placeholderIndex++);
                placeholderMap.set(altPlaceholder, altText);
                return `![${altPlaceholder}](${urlPlaceholder})`;
            } else {
                const placeholder = this.generateSafePlaceholder('IMAGE', placeholderIndex++);
                placeholderMap.set(placeholder, match);
                return placeholder;
            }
        });

        // 替换链接（保留链接文本用于翻译）
        processedText = processedText.replace(this.linkPattern, (match, linkText, url) => {
            const urlPlaceholder = this.generateSafePlaceholder('LINK_URL', placeholderIndex++);
            placeholderMap.set(urlPlaceholder, url);

            if (linkText && linkText.trim() && !this.isUrl(linkText)) {
                const textPlaceholder = this.generateSafePlaceholder('LINK_TEXT', placeholderIndex++);
                placeholderMap.set(textPlaceholder, linkText);
                return `[${textPlaceholder}](${urlPlaceholder})`;
            } else {
                const placeholder = this.generateSafePlaceholder('LINK', placeholderIndex++);
                placeholderMap.set(placeholder, match);
                return placeholder;
            }
        });

        // 替换HTML标签
        processedText = processedText.replace(this.htmlTagPattern, (match) => {
            const placeholder = this.generateSafePlaceholder('HTML_TAG', placeholderIndex++);
            placeholderMap.set(placeholder, match);
            return placeholder;
        });

        // 按行分析结构
        const finalLines = processedText.split('\n');
        const translatableLines: string[] = [];
        const lineStructure: LineInfo[] = [];

        for (const line of finalLines) {
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

            // 代码块行（占位符）
            if (this.isCodeBlockPlaceholder(trimmedLine)) {
                translatableLines.push(line);
                lineStructure.push({
                    originalLine: line,
                    type: 'code_block'
                });
                continue;
            }

            // 表格分隔行
            if (this.tableSeparatorPattern.test(trimmedLine)) {
                translatableLines.push(line);
                lineStructure.push({
                    originalLine: line,
                    type: 'table_separator'
                });
                continue;
            }

            // 表格行
            if (this.tableRowPattern.test(trimmedLine)) {
                const tableData = this.parseTableRow(trimmedLine);
                const translatableCells = tableData
                    .filter(cell => cell.isTranslatable)
                    .map(cell => cell.translatableContent || '')
                    .join('\n');

                translatableLines.push(translatableCells);
                lineStructure.push({
                    originalLine: line,
                    type: 'table_row',
                    tableData: tableData
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

                case 'code_block':
                case 'table_separator':
                case 'placeholder_only':
                    const restoredLine = this.restorePlaceholders(lineInfo.originalLine, placeholderMap);
                    result.push(restoredLine);
                    translatedIndex++;
                    break;

                case 'table_row':
                    if (lineInfo.tableData && translatedIndex < translatedContent.length) {
                        const reassembledTable = this.reassembleTableRow(
                            lineInfo.tableData,
                            translatedContent[translatedIndex],
                            placeholderMap
                        );
                        result.push(reassembledTable);
                    } else {
                        const restoredLine = this.restorePlaceholders(lineInfo.originalLine, placeholderMap);
                        result.push(restoredLine);
                    }
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
            /___CODE_BLOCK_LINE_\d+___SAFE___/g,
            /___INLINE_CODE_\d+___SAFE___/g,
            /___IMG_ALT_\d+___SAFE___/g,
            /___IMG_URL_\d+___SAFE___/g,
            /___LINK_TEXT_\d+___SAFE___/g,
            /___LINK_URL_\d+___SAFE___/g,
            /___IMAGE_\d+___SAFE___/g,
            /___LINK_\d+___SAFE___/g,
            /___HTML_TAG_\d+___SAFE___/g
        ];

        for (const pattern of placeholderPatterns) {
            restoredText = restoredText.replace(pattern, (match) => {
                return placeholderMap.get(match) || match;
            });
        }

        // 额外的容错机制：处理可能被翻译引擎修改的占位符
        restoredText = this.restoreCorruptedPlaceholders(restoredText, placeholderMap);

        return restoredText;
    }

    private isPlaceholderOnly(text: string): boolean {
        const placeholderPatterns = [
            /^___CODE_BLOCK_LINE_\d+___SAFE___$/,
            /^___INLINE_CODE_\d+___SAFE___$/,
            /^___IMAGE_\d+___SAFE___$/,
            /^___LINK_\d+___SAFE___$/,
            /^___HTML_TAG_\d+___SAFE___$/
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

    /**
     * 生成安全的占位符
     */
    private generateSafePlaceholder(type: string, index: number): string {
        return `___${type}_${index}___SAFE___`;
    }

    /**
     * 检查是否为代码块占位符
     */
    private isCodeBlockPlaceholder(text: string): boolean {
        return /^___CODE_BLOCK_LINE_\d+___SAFE___$/.test(text.trim());
    }

    /**
     * 解析表格行
     */
    private parseTableRow(line: string): TableCellData[] {
        const trimmed = line.trim();
        // 移除首尾的 |
        const cellsText = trimmed.slice(1, -1);
        const cells = cellsText.split('|');

        return cells.map(cell => {
            const trimmedCell = cell.trim();
            const isTranslatable = !!(trimmedCell &&
                                      !this.isPlaceholderOnly(trimmedCell) &&
                                      !/^[\s\-\:\|]*$/.test(trimmedCell)); // 不是分隔符内容

            return {
                originalContent: trimmedCell,
                translatableContent: isTranslatable ? trimmedCell : undefined,
                isTranslatable
            };
        });
    }

    /**
     * 重新组装表格行
     */
    private reassembleTableRow(
        tableData: TableCellData[],
        translatedContent: string,
        placeholderMap: Map<string, string>
    ): string {
        const translatedCells = translatedContent.split('\n').filter(cell => cell.trim());
        let translatedIndex = 0;

        const reassembledCells = tableData.map(cellData => {
            if (cellData.isTranslatable && translatedIndex < translatedCells.length) {
                const translatedCell = this.restorePlaceholders(translatedCells[translatedIndex], placeholderMap);
                translatedIndex++;
                return translatedCell;
            } else {
                return this.restorePlaceholders(cellData.originalContent, placeholderMap);
            }
        });

        return '| ' + reassembledCells.join(' | ') + ' |';
    }

    /**
     * 恢复可能被翻译引擎损坏的占位符
     */
    private restoreCorruptedPlaceholders(text: string, placeholderMap: Map<string, string>): string {
        let restoredText = text;

        // 尝试匹配可能被修改的占位符模式
        for (const [placeholder, originalText] of placeholderMap.entries()) {
            // 移除特殊字符后的模糊匹配
            const simplifiedPlaceholder = placeholder.replace(/[_]/g, '').toLowerCase();
            const pattern = new RegExp(simplifiedPlaceholder.replace(/\d+/g, '\\d*'), 'gi');

            if (pattern.test(restoredText)) {
                restoredText = restoredText.replace(pattern, originalText);
            }
        }

        return restoredText;
    }
}