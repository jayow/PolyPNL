/**
 * Centralized logging utility
 * Sanitizes sensitive data and respects environment settings
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Sanitize sensitive data from log messages
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    // Remove wallet addresses (0x followed by 40 hex chars)
    let sanitized = data.replace(/0x[a-fA-F0-9]{40}/gi, '[WALLET_ADDRESS]');
    // Remove URLs (basic pattern)
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    return sanitized;
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(sanitizeData);
    }
    
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields
      if (key.toLowerCase().includes('wallet') || 
          key.toLowerCase().includes('address') ||
          key.toLowerCase().includes('url') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('password')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Logger class with environment-aware logging
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isProduction = process.env.NODE_ENV === 'production';

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Log everything in development
    }
    
    if (this.isProduction) {
      // In production, only log errors and warnings
      return level === 'error' || level === 'warn';
    }
    
    return true; // Default: log everything
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedArgs = args.map(sanitizeData);
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'error':
        console.error(prefix, message, ...sanitizedArgs);
        break;
      case 'warn':
        console.warn(prefix, message, ...sanitizedArgs);
        break;
      case 'info':
        console.info(prefix, message, ...sanitizedArgs);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(prefix, message, ...sanitizedArgs);
        }
        break;
    }
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();
