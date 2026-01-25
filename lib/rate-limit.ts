import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting configuration for API routes
 * Uses Upstash Redis for distributed rate limiting
 */

// Initialize Redis client
// If Upstash credentials are not set, rate limiting will be disabled
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Rate limiters for different endpoint types
 */

// PnL endpoint - 10 requests per minute (resource-intensive)
export const pnlRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: '@ratelimit/pnl',
    })
  : null;

// Screenshot endpoint - 5 requests per minute (very resource-intensive with Puppeteer)
export const screenshotRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: '@ratelimit/screenshot',
    })
  : null;

// Image proxy - 20 requests per minute
export const imageProxyRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: '@ratelimit/image-proxy',
    })
  : null;

// Resolve username - 15 requests per minute
export const resolveUsernameRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(15, '1 m'),
      analytics: true,
      prefix: '@ratelimit/resolve-username',
    })
  : null;

// Default rate limiter - 30 requests per minute for other endpoints
export const defaultRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: '@ratelimit/default',
    })
  : null;

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  // Try various headers that proxies/load balancers use
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  // Fallback to 'unknown' if no IP found
  return 'unknown';
}

/**
 * Check rate limit and return result
 * Returns null if rate limiting is disabled (no Redis)
 */
export async function checkRateLimit(
  rateLimiter: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} | null> {
  if (!rateLimiter) {
    // Rate limiting disabled (no Redis configured)
    // In development, allow all requests
    // In production, this should be configured
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Rate Limit] Rate limiting disabled - Redis not configured');
      return {
        success: true,
        limit: Infinity,
        remaining: Infinity,
        reset: Date.now() + 60000,
      };
    }
    // In production without Redis, we should still allow requests
    // but log a warning
    console.warn('[Rate Limit] Rate limiting disabled in production - Redis not configured');
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Date.now() + 60000,
    };
  }
  
  const result = await rateLimiter.limit(identifier);
  
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Create rate limit error response
 */
export function createRateLimitResponse(reset: number): Response {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    }
  );
}
