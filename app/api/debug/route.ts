import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet') || '0x1234567890123456789012345678901234567890';
    const testType = searchParams.get('test') || 'proxy';

    if (testType === 'proxy') {
      // Test proxy wallet endpoint
      const url = `https://gamma-api.polymarket.com/public-profile?wallet=${encodeURIComponent(wallet.toLowerCase())}`;
      console.log(`[DEBUG] Testing proxy wallet endpoint: ${url}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json().catch(() => ({ error: 'Failed to parse JSON' }));
        
        return NextResponse.json({
          test: 'proxy',
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          data,
        });
      } catch (error) {
        return NextResponse.json({
          test: 'proxy',
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    } else if (testType === 'trades') {
      // Test trades endpoint
      const userAddress = wallet.toLowerCase();
      const url = `https://data-api.polymarket.com/trades?user=${encodeURIComponent(userAddress)}&page=1&pageSize=10`;
      console.log(`[DEBUG] Testing trades endpoint: ${url}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json().catch(() => ({ error: 'Failed to parse JSON' }));
        
        return NextResponse.json({
          test: 'trades',
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          dataType: Array.isArray(data) ? 'array' : typeof data,
          dataKeys: Array.isArray(data) ? `array(${data.length})` : Object.keys(data || {}),
          dataSample: Array.isArray(data) 
            ? data.slice(0, 2) 
            : typeof data === 'object' 
              ? JSON.stringify(data).substring(0, 500)
              : data,
        });
      } catch (error) {
        return NextResponse.json({
          test: 'trades',
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid test type. Use ?test=proxy or ?test=trades' }, { status: 400 });
  } catch (error) {
    console.error('Error in /api/debug:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
