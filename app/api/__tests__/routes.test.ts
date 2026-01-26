/**
 * Integration tests for API routes
 * Tests validation, error handling, and basic functionality
 */

// Mock global Response if not available
if (typeof Response === 'undefined') {
  global.Response = class MockResponse {
    body: any;
    status: number;
    statusText: string;
    headers: Headers;
    ok: boolean;

    constructor(body?: any, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = this.status >= 200 && this.status < 300 ? 'OK' : 'Error';
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
  } as any;
}

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    nextUrl: URL;
    
    constructor(url: string) {
      this.url = url;
      this.nextUrl = new URL(url);
    }
    
    get headers() {
      return new Headers();
    }
  },
  NextResponse: {
    json: (body: any, init?: { status?: number }) => {
      return new (global as any).Response(JSON.stringify(body), {
        status: init?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  },
}));

// Mock the API client functions
jest.mock('@/lib/api-client', () => ({
  resolveProxyWallet: jest.fn(),
  fetchAllTrades: jest.fn(),
  fetchClosedPositions: jest.fn(),
  normalizeTrade: jest.fn(),
  enrichTradesWithMetadata: jest.fn(),
}));

// Mock rate limiting
jest.mock('@/lib/rate-limit', () => ({
  defaultRateLimiter: null,
  pnlRateLimiter: null,
  imageProxyRateLimiter: null,
  getClientIP: jest.fn(() => '127.0.0.1'),
  checkRateLimit: jest.fn(() => Promise.resolve({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 })),
  createRateLimitResponse: jest.fn(),
}));

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/resolve', () => {
    it('should validate wallet parameter', async () => {
      const { GET } = await import('../resolve/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/resolve');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should accept valid wallet address', async () => {
      const { resolveProxyWallet } = require('@/lib/api-client');
      resolveProxyWallet.mockResolvedValue({
        inputWallet: '0x123',
        userAddressUsed: '0x123',
        proxyWalletFound: false,
      });

      const { GET } = await import('../resolve/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/resolve?wallet=0x1234567890123456789012345678901234567890');
      
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(resolveProxyWallet).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should reject invalid wallet format', async () => {
      const { GET } = await import('../resolve/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/resolve?wallet=invalid');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });
  });

  describe('GET /api/trades', () => {
    it('should validate required parameters', async () => {
      const { GET } = await import('../trades/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/trades');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should accept valid wallet and optional date range', async () => {
      const { resolveProxyWallet, fetchAllTrades, normalizeTrade, enrichTradesWithMetadata } = require('@/lib/api-client');
      
      resolveProxyWallet.mockResolvedValue({
        inputWallet: '0x123',
        userAddressUsed: '0x123',
        proxyWalletFound: false,
      });
      
      fetchAllTrades.mockResolvedValue([]);
      normalizeTrade.mockImplementation((trade) => trade);
      enrichTradesWithMetadata.mockResolvedValue([]);

      const { GET } = await import('../trades/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/trades?wallet=0x1234567890123456789012345678901234567890');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.trades).toBeDefined();
      expect(Array.isArray(data.trades)).toBe(true);
    });
  });

  describe('GET /api/pnl', () => {
    it('should validate required parameters', async () => {
      const { GET } = await import('../pnl/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/pnl');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should accept valid parameters', async () => {
      const { resolveProxyWallet, fetchAllTrades, normalizeTrade, enrichTradesWithMetadata } = require('@/lib/api-client');
      
      resolveProxyWallet.mockResolvedValue({
        inputWallet: '0x123',
        userAddressUsed: '0x123',
        proxyWalletFound: false,
      });
      
      fetchAllTrades.mockResolvedValue([]);
      normalizeTrade.mockImplementation((trade) => trade);
      enrichTradesWithMetadata.mockResolvedValue([]);

      const { GET } = await import('../pnl/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/pnl?wallet=0x1234567890123456789012345678901234567890&method=fifo');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.positions).toBeDefined();
      expect(data.summary).toBeDefined();
    });
  });

  describe('GET /api/image-proxy', () => {
    it('should validate URL parameter', async () => {
      const { GET } = await import('../image-proxy/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/image-proxy');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should reject non-allowed domains', async () => {
      const { GET } = await import('../image-proxy/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/image-proxy?url=https://evil.com/image.png');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(403);
      expect(data.error).toBe('Domain not allowed');
    });

    it('should accept allowed domains', async () => {
      // Mock fetch to return a valid image response
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({
            'Content-Type': 'image/png',
            'Content-Length': '1000',
          }),
          body: {
            getReader: () => ({
              read: () => Promise.resolve({ done: true, value: undefined }),
            }),
          },
        } as any)
      );

      const { GET } = await import('../image-proxy/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/image-proxy?url=https://polymarket.com/image.png');
      
      const response = await GET(request);
      
      // Should attempt to fetch (may fail in test environment, but should not be 403)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle API client errors gracefully', async () => {
      const { resolveProxyWallet } = require('@/lib/api-client');
      resolveProxyWallet.mockRejectedValue(new Error('API Error'));

      const { GET } = await import('../resolve/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/resolve?wallet=0x1234567890123456789012345678901234567890');
      
      const response = await GET(request);
      
      expect(response.status).toBe(500);
    });

    it('should handle network timeouts', async () => {
      const { resolveProxyWallet } = require('@/lib/api-client');
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      resolveProxyWallet.mockRejectedValue(timeoutError);

      const { GET } = await import('../resolve/route');
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3000/api/resolve?wallet=0x1234567890123456789012345678901234567890');
      
      const response = await GET(request);
      
      expect(response.status).toBe(500);
    });
  });
});
