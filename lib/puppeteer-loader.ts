/**
 * Lazy loader for Puppeteer to prevent build-time issues
 * This file is only executed at runtime, never during build
 */

let puppeteerCache: typeof import('puppeteer') | null = null;
let loadError: Error | null = null;

export async function loadPuppeteer() {
  if (puppeteerCache) {
    return puppeteerCache;
  }
  
  if (loadError) {
    throw loadError;
  }
  
  // Only load at runtime, never during build
  if (typeof window !== 'undefined') {
    loadError = new Error('Puppeteer can only be loaded in Node.js runtime');
    throw loadError;
  }
  
  try {
    puppeteerCache = await import('puppeteer');
    return puppeteerCache;
  } catch (error) {
    loadError = error as Error;
    throw error;
  }
}
