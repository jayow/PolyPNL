import { NextRequest, NextResponse } from 'next/server';

/**
 * Health check endpoint
 * Useful for monitoring and load balancer health checks
 */
export async function GET(request: NextRequest) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'unknown',
    services: {
      // Check external API connectivity (basic check)
      polymarket: 'unknown' as 'ok' | 'error' | 'unknown',
    },
  };

  try {
    // Quick connectivity check to Polymarket API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch('https://gamma-api.polymarket.com/public-profile?wallet=0x0000000000000000000000000000000000000000', {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      clearTimeout(timeoutId);
      health.services.polymarket = response.ok ? 'ok' : 'error';
    } catch (error) {
      clearTimeout(timeoutId);
      health.services.polymarket = 'error';
    }
  } catch (error) {
    // If health check fails, still return ok status (don't fail health check)
    health.services.polymarket = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  
  return NextResponse.json(health, { status: statusCode });
}
