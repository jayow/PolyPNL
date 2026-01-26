/**
 * Puppeteer request queue to limit concurrent browser instances
 * Prevents resource exhaustion from too many simultaneous Puppeteer launches
 */

const MAX_CONCURRENT_BROWSERS = 3;
const QUEUE_TIMEOUT_MS = 30000; // 30 seconds

interface QueueItem {
  resolve: (value: () => Promise<void>) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

class PuppeteerQueue {
  private running = 0;
  private queue: QueueItem[] = [];

  /**
   * Acquire a slot in the queue
   * Returns a release function that must be called when done
   */
  async acquire(): Promise<() => Promise<void>> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Check if we can run immediately
      if (this.running < MAX_CONCURRENT_BROWSERS) {
        this.running++;
        resolve(() => this.release());
        return;
      }

      // Add to queue
      this.queue.push(item);

      // Set timeout for queued requests
      setTimeout(() => {
        const index = this.queue.indexOf(item);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Request timeout: Queue wait time exceeded'));
        }
      }, QUEUE_TIMEOUT_MS);
    });
  }

  /**
   * Release a slot and process next in queue
   */
  private release(): Promise<void> {
    this.running--;
    
    // Process next in queue
    if (this.queue.length > 0 && this.running < MAX_CONCURRENT_BROWSERS) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next.resolve(() => this.release());
      }
    }
    
    return Promise.resolve();
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: MAX_CONCURRENT_BROWSERS,
    };
  }
}

// Singleton instance
export const puppeteerQueue = new PuppeteerQueue();
