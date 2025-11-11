import * as vscode from 'vscode';

export interface TranslationTask {
  id: string;
  text: string;
  targetLang: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  retryCount: number;
}

type TranslateFunction = (text: string, targetLang: string) => Promise<string>;

export class TranslationQueue {
  private queue: TranslationTask[] = [];
  private isProcessing = false;
  private currentTask: TranslationTask | null = null;
  private maxRetries: number;
  private retryDelay: number;
  private onProgress?: (progress: { completed: number; total: number; current: string }) => void;

  constructor(
    private translateFn: TranslateFunction,
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      onProgress?: (progress: { completed: number; total: number; current: string }) => void;
    }
  ) {
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelay = options?.retryDelay ?? 1000;
    this.onProgress = options?.onProgress;
  }

  // 添加任务到队列
  addTask(text: string, targetLang: string): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const task: TranslationTask = {
      id,
      text,
      targetLang,
      status: 'pending',
      retryCount: 0
    };
    this.queue.push(task);
    return id;
  }

  // 批量添加任务
  addTasks(texts: string[], targetLang: string): string[] {
    return texts.map(text => this.addTask(text, targetLang));
  }

  // 开始处理队列
  async start(): Promise<Map<string, string>> {
    if (this.isProcessing) {
      throw new Error('Queue is already processing');
    }

    this.isProcessing = true;
    const results = new Map<string, string>();

    try {
      while (this.queue.length > 0) {
        const task = this.queue[0];
        this.currentTask = task;

        try {
          task.status = 'processing';
          this.reportProgress();

          const result = await this.translateWithRetry(task);
          task.result = result;
          task.status = 'completed';
          results.set(task.id, result);

          // 从队列中移除已完成的任务
          this.queue.shift();
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : String(error);

          // 失败的任务也从队列移除，避免阻塞
          this.queue.shift();

          // 抛出错误以便调用方知道有任务失败
          throw new Error(`Task ${task.id} failed after ${task.retryCount} retries: ${task.error}`);
        }
      }
    } finally {
      this.isProcessing = false;
      this.currentTask = null;
    }

    return results;
  }

  // 带重试的翻译
  private async translateWithRetry(task: TranslationTask): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        task.retryCount = attempt;
        const result = await this.translateFn(task.text, task.targetLang);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 如果还有重试机会，等待后重试
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * (attempt + 1)); // 指数退避
          continue;
        }
      }
    }

    throw lastError || new Error('Translation failed');
  }

  // 获取队列状态
  getStatus() {
    const completed = this.queue.filter(t => t.status === 'completed').length;
    const failed = this.queue.filter(t => t.status === 'failed').length;
    const pending = this.queue.filter(t => t.status === 'pending').length;
    const processing = this.queue.filter(t => t.status === 'processing').length;

    return {
      total: this.queue.length + completed + failed,
      completed,
      failed,
      pending,
      processing,
      isProcessing: this.isProcessing,
      currentTask: this.currentTask
    };
  }

  // 清空队列
  clear() {
    this.queue = [];
    this.currentTask = null;
  }

  // 暂停处理（通过设置标志）
  pause() {
    this.isProcessing = false;
  }

  // 报告进度
  private reportProgress() {
    if (this.onProgress && this.currentTask) {
      const status = this.getStatus();
      this.onProgress({
        completed: status.completed,
        total: status.total,
        current: this.currentTask.text.substring(0, 50) + '...'
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 用于 Translator 类的队列管理器适配器
export class TranslationQueueManager {
  private queue: TranslationQueue | null = null;

  async processSegments(
    segments: string[],
    targetLang: string,
    translateFn: TranslateFunction,
    options?: {
      maxRetries?: number;
      onProgress?: (index: number, total: number) => void;
    }
  ): Promise<string[]> {
    this.queue = new TranslationQueue(translateFn, {
      maxRetries: options?.maxRetries ?? 3,
      retryDelay: 1000,
      onProgress: (progress) => {
        if (options?.onProgress) {
          options.onProgress(progress.completed, progress.total);
        }
      }
    });

    // 添加所有任务到队列
    const taskIds = this.queue.addTasks(segments, targetLang);

    try {
      // 开始处理
      const results = await this.queue.start();

      // 按照原始顺序返回结果
      return taskIds.map(id => results.get(id) || '');
    } catch (error) {
      // 即使部分失败，也返回已完成的结果
      const status = this.queue.getStatus();
      throw new Error(`Translation queue failed: ${error}. Completed: ${status.completed}/${status.total}`);
    }
  }

  cancel() {
    if (this.queue) {
      this.queue.pause();
      this.queue.clear();
    }
  }

  getStatus() {
    return this.queue?.getStatus() ?? null;
  }
}
