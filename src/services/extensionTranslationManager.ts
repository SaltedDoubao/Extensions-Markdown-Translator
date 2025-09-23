import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getSecretStorageManager } from '../extension';

export interface ExtensionInfo {
  id: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  isInstalled: boolean;
  extensionPath?: string;
  marketplaceUrl?: string;
}

export interface ExtensionDocs {
  readme?: string;
  changelog?: string;
  readmePath?: string;
  changelogPath?: string;
}

/**
 * 扩展翻译管理器
 * 负责识别扩展、获取文档并执行翻译
 */
export class ExtensionTranslationManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 通过扩展ID获取扩展信息
   */
  async getExtensionInfo(extensionId: string): Promise<ExtensionInfo | null> {
    // 首先检查是否已安装
    const installedExtension = vscode.extensions.getExtension(extensionId);

    if (installedExtension) {
      return {
        id: extensionId,
        displayName: installedExtension.packageJSON.displayName || installedExtension.packageJSON.name,
        description: installedExtension.packageJSON.description || '',
        version: installedExtension.packageJSON.version,
        publisher: installedExtension.packageJSON.publisher,
        isInstalled: true,
        extensionPath: installedExtension.extensionPath,
        marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`
      };
    }

    // 如果未安装，尝试从Marketplace获取信息
    try {
      const marketplaceInfo = await this.getMarketplaceExtensionInfo(extensionId);
      return marketplaceInfo;
    } catch (error) {
      console.error('Failed to get extension info from marketplace:', error);
      return null;
    }
  }

  /**
   * 从Marketplace API获取扩展信息
   */
  private async getMarketplaceExtensionInfo(extensionId: string): Promise<ExtensionInfo | null> {
    const [publisher, name] = extensionId.split('.');
    if (!publisher || !name) {
      throw new Error('Invalid extension ID format');
    }

    // VS Code Marketplace API
    const apiUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
    const requestBody = {
      filters: [{
        criteria: [
          { filterType: 7, value: extensionId }
        ],
        pageNumber: 1,
        pageSize: 1,
        sortBy: 0,
        sortOrder: 0
      }],
      assetTypes: [],
      flags: 914
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json;api-version=6.0-preview.1'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.status}`);
      }

      const data = await response.json();
      const extension = data.results?.[0]?.extensions?.[0];

      if (!extension) {
        return null;
      }

      return {
        id: extensionId,
        displayName: extension.displayName || extension.extensionName,
        description: extension.shortDescription || '',
        version: extension.versions?.[0]?.version || '0.0.0',
        publisher: extension.publisher.publisherName,
        isInstalled: false,
        marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${extensionId}`
      };
    } catch (error) {
      console.error('Marketplace API request failed:', error);
      return null;
    }
  }

  /**
   * 获取扩展的文档内容
   */
  async getExtensionDocs(extensionInfo: ExtensionInfo): Promise<ExtensionDocs> {
    if (extensionInfo.isInstalled && extensionInfo.extensionPath) {
      return this.getLocalExtensionDocs(extensionInfo.extensionPath);
    } else {
      return this.getMarketplaceExtensionDocs(extensionInfo.id);
    }
  }

  /**
   * 从本地安装的扩展获取文档
   */
  private async getLocalExtensionDocs(extensionPath: string): Promise<ExtensionDocs> {
    const docs: ExtensionDocs = {};

    // 查找README文件
    const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
    for (const filename of readmeFiles) {
      const readmePath = path.join(extensionPath, filename);
      if (fs.existsSync(readmePath)) {
        docs.readmePath = readmePath;
        docs.readme = fs.readFileSync(readmePath, 'utf-8');
        break;
      }
    }

    // 查找CHANGELOG文件
    const changelogFiles = ['CHANGELOG.md', 'changelog.md', 'CHANGELOG.MD', 'Changelog.md', 'HISTORY.md'];
    for (const filename of changelogFiles) {
      const changelogPath = path.join(extensionPath, filename);
      if (fs.existsSync(changelogPath)) {
        docs.changelogPath = changelogPath;
        docs.changelog = fs.readFileSync(changelogPath, 'utf-8');
        break;
      }
    }

    return docs;
  }

  /**
   * 从Marketplace获取扩展文档
   */
  private async getMarketplaceExtensionDocs(extensionId: string): Promise<ExtensionDocs> {
    // 这里可以实现从Marketplace获取README内容的逻辑
    // 目前Marketplace API不直接提供README内容，可能需要解析HTML或使用其他方法
    const docs: ExtensionDocs = {};

    try {
      // 获取扩展页面HTML并解析README内容
      const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${extensionId}`;
      const response = await fetch(marketplaceUrl);
      const html = await response.text();

      // 这里需要解析HTML来提取README内容
      // 由于Marketplace页面结构复杂，这是一个简化实现
      const readmeMatch = html.match(/<div[^>]*class="[^"]*readme[^"]*"[^>]*>(.*?)<\/div>/is);
      if (readmeMatch) {
        // 简单的HTML标签清理
        docs.readme = readmeMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim();
      }
    } catch (error) {
      console.error('Failed to get marketplace extension docs:', error);
    }

    return docs;
  }

  /**
   * 列出所有已安装的扩展
   */
  getInstalledExtensions(): ExtensionInfo[] {
    return vscode.extensions.all
      .filter(ext => !ext.id.startsWith('vscode.'))  // 过滤内置扩展
      .map(ext => ({
        id: ext.id,
        displayName: ext.packageJSON.displayName || ext.packageJSON.name,
        description: ext.packageJSON.description || '',
        version: ext.packageJSON.version,
        publisher: ext.packageJSON.publisher,
        isInstalled: true,
        extensionPath: ext.extensionPath,
        marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${ext.id}`
      }));
  }

  /**
   * 从URL解析扩展ID
   */
  parseExtensionIdFromUrl(url: string): string | null {
    const marketplaceUrlPattern = /marketplace\.visualstudio\.com\/items\?itemName=([^&]+)/;
    const match = url.match(marketplaceUrlPattern);
    return match ? match[1] : null;
  }
}