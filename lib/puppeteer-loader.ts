/**
 * Lazy loader for Puppeteer to prevent build-time issues
 * This file is only executed at runtime, never during build
 */

let puppeteerCache: typeof import('puppeteer') | null = null;

export async function loadPuppeteer() {
  if (puppeteerCache) {
    return puppeteerCache;
  }
  
  // Only load at runtime, never during build
  if (typeof window !== 'undefined' || process.env.NEXT_PHASE === 'phase-production-build') {
    throw new Error('Puppeteer can only be loaded in Node.js runtime');
  }
  
  puppeteerCache = await import('puppeteer');
  return puppeteerCache;
}
