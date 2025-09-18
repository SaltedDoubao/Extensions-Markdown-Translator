#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { MarkdownProcessor } from '../utils/markdownProcessor';
import { TranslatorService } from '../services/translatorService';

interface CLIOptions {
    input: string;
    output?: string;
    language: string;
    engine: string;
}

function parseArguments(): CLIOptions {
    const args = process.argv.slice(2);
    const options: Partial<CLIOptions> = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-i':
            case '--input':
                options.input = args[++i];
                break;
            case '-o':
            case '--output':
                options.output = args[++i];
                break;
            case '-l':
            case '--language':
                options.language = args[++i];
                break;
            case '-e':
            case '--engine':
                options.engine = args[++i];
                break;
            case '-h':
            case '--help':
                showHelp();
                process.exit(0);
        }
    }

    if (!options.input) {
        console.error('Error: Input file is required');
        showHelp();
        process.exit(1);
    }

    return {
        input: options.input,
        output: options.output,
        language: options.language || 'zh-CN',
        engine: options.engine || 'google'
    };
}

function showHelp() {
    console.log(`
Markdown Translator CLI

Usage: emt [options]

Options:
  -i, --input <file>      Input markdown file path (required)
  -o, --output <file>     Output file path (optional, defaults to input-copy.md)
  -l, --language <lang>   Target language (default: zh-CN)
                          Supported: zh-CN, en, ja, ko, fr, de, es, ru
  -e, --engine <engine>   Translation engine (default: google)
                          Supported: google, baidu, microsoft, siliconflow, openai, openai-compatible, local-llm, claude, gemini
  -h, --help              Show this help message

Examples:
  emt -i README.md -l zh-CN
  emt -i docs/guide.md -o docs/guide-zh.md -l zh-CN -e openai
`);
}

function generateOutputPath(inputPath: string, language: string, customOutput?: string): string {
    if (customOutput) {
        return customOutput;
    }

    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const nameWithoutExt = path.basename(inputPath, ext);

    // Special handling for README files
    if (nameWithoutExt.toLowerCase() === 'readme') {
        return path.join(dir, `README.${language}${ext}`);
    }

    // Regular files get -copy suffix
    return path.join(dir, `${nameWithoutExt}-copy${ext}`);
}

async function main() {
    try {
        const options = parseArguments();

        // Check if input file exists
        if (!fs.existsSync(options.input)) {
            console.error(`Error: Input file '${options.input}' does not exist`);
            process.exit(1);
        }

        // Read input file
        const inputContent = fs.readFileSync(options.input, 'utf8');

        // Initialize processor and translator
        const processor = new MarkdownProcessor();
        const translator = new TranslatorService();

        console.log(`Translating '${options.input}' to ${options.language} using ${options.engine}...`);

        // Extract translatable content
        const extractResult = processor.extractTranslatableContent(inputContent);

        if (extractResult.translatableLines.length === 0) {
            console.log('No translatable content found.');
            return;
        }

        // Set translation engine
        if (!translator.setEngine(options.engine)) {
            console.error(`Error: Unsupported translation engine '${options.engine}'`);
            process.exit(1);
        }

        // Convert language code for internal use
        const internalLangCode = getInternalLanguageCode(options.language);

        // Translate content
        const translatedContent = await translator.translateBatch(
            extractResult.translatableLines,
            internalLangCode
        );

        // Reassemble content
        const finalContent = processor.reassembleContent(
            extractResult.lineStructure,
            translatedContent,
            extractResult.placeholderMap
        );

        // Generate output path
        const outputPath = generateOutputPath(options.input, options.language, options.output);

        // Write output file
        fs.writeFileSync(outputPath, finalContent, 'utf8');

        console.log(`Translation completed! Output file: ${outputPath}`);

    } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    }
}

function getInternalLanguageCode(configLanguage: string): string {
    const codeMap: { [key: string]: string } = {
        'zh-CN': 'zh',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'de': 'de',
        'es': 'es',
        'ru': 'ru'
    };

    return codeMap[configLanguage] || 'zh';
}

// Run the CLI
if (require.main === module) {
    main();
}