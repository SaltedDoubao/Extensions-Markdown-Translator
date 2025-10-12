export interface TranslationConfig {
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationEngine {
  name: string;
  translate(text: string, config: TranslationConfig): Promise<string>;
  isConfigured(): boolean;
  validateConfig(): Promise<boolean>;
}

export abstract class BaseTranslationEngine implements TranslationEngine {
  abstract name: string;

  abstract translate(text: string, config: TranslationConfig): Promise<string>;
  abstract isConfigured(): boolean;
  abstract validateConfig(): Promise<boolean>;

  protected makeHttpRequest(url: string, options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeout?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const http = require('http');
      const urlObj = new URL(url);

      const headers: Record<string, string> = { ...options.headers };
      if (options.body && !headers['Content-Length']) {
        headers['Content-Length'] = Buffer.byteLength(options.body, 'utf8').toString();
      }

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers,
        timeout: options.timeout ?? 120000
      };

      const httpModule = urlObj.protocol === 'https:' ? https : http;

      const req = httpModule.request(requestOptions, (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const result = data.startsWith('{') || data.startsWith('[') ? JSON.parse(data) : data;
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error('Failed to parse response: ' + error));
          }
        });
      });

      req.on('error', (error: any) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  protected getLanguageCode(lang: string): string {
    const langMap: { [key: string]: string } = {
      'zh-CN': 'zh',
      'zh-TW': 'zh-TW',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'ru': 'ru',
      'ar': 'ar',
      'hi': 'hi',
      'pt': 'pt',
      'it': 'it'
    };
    return langMap[lang] || lang;
  }
}