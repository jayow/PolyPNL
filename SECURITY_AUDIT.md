# Security & Architecture Audit Report

**Date:** 2024-12-19  
**Branch:** `audit`  
**Auditor:** AI Assistant  
**Scope:** Full codebase review against provided Security & Architecture Rules

---

## Executive Summary

This audit reviewed the Poly PNL codebase against the provided "SECURITY & ARCHITECTURE RULES". The application is a Next.js-based Polymarket PnL tracker that does **NOT** use Supabase or any database. However, several security and architecture issues were identified that need to be addressed.

**Overall Status:** ⚠️ **NEEDS IMPROVEMENT**

---

## ✅ COMPLIANT AREAS

### 1. Backend-First Data Access ✅
- **Status:** COMPLIANT
- **Finding:** No client-side database operations found. All data fetching happens through Next.js API routes (`/app/api/*`).
- **Evidence:**
  - No Supabase client usage in codebase
  - All API calls go through `/api/pnl`, `/api/activities`, `/api/trades`, etc.
  - Client components only call API routes, never databases directly

### 2. No Database Usage ✅
- **Status:** COMPLIANT
- **Finding:** Application does not use Supabase or any database. All data is fetched from external Polymarket APIs.
- **Evidence:** No database-related code found in codebase.

---

## ❌ CRITICAL ISSUES

### 1. Missing Input Validation (Zod) ❌
- **Severity:** HIGH
- **Rule Violated:** "All API routes MUST use Zod for input validation"
- **Finding:** **NO Zod validation found in any API routes**
- **Affected Files:**
  - `app/api/pnl/route.ts` - No validation for `wallet`, `method` parameters
  - `app/api/image-proxy/route.ts` - Only basic URL validation (not Zod)
  - `app/api/resolve-username/route.ts` - No validation for `username` parameter
  - `app/api/screenshot/route.ts` - No validation for `html`, `width`, `height`
  - `app/api/activities/route.ts` - No validation for query parameters
  - `app/api/trades/route.ts` - No validation
  - `app/api/resolve/route.ts` - No validation
  - `app/api/debug/route.ts` - No validation

**Recommendation:**
```typescript
// Example fix for app/api/pnl/route.ts
import { z } from 'zod';

const pnlQuerySchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  method: z.enum(['fifo', 'avg']).optional().default('fifo'),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const validation = pnlQuerySchema.safeParse({
    wallet: searchParams.get('wallet'),
    method: searchParams.get('method') || 'fifo',
  });
  
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }
  
  const { wallet, method } = validation.data;
  // ... rest of code
}
```

### 2. No Rate Limiting ❌
- **Severity:** HIGH
- **Rule Violated:** Implicit (rate limiting is a security best practice)
- **Finding:** **No rate limiting implemented on any API routes**
- **Risk:** 
  - API abuse/DoS attacks
  - Resource exhaustion (especially `/api/screenshot` with Puppeteer)
  - Cost escalation from external API calls

**Recommendation:**
- Implement rate limiting using `@upstash/ratelimit` or similar
- Set different limits per endpoint:
  - `/api/pnl`: 10 requests/minute per IP
  - `/api/screenshot`: 5 requests/minute per IP (resource-intensive)
  - `/api/image-proxy`: 20 requests/minute per IP
  - Other endpoints: 30 requests/minute per IP

### 3. Image Proxy Security Issues ❌
- **Severity:** HIGH
- **Rule Violated:** "Backend-First" security model
- **Finding:** 
  1. **Weak URL validation** - Only checks if URL is valid, doesn't restrict domains
  2. **Open CORS** - `Access-Control-Allow-Origin: *` allows any origin
  3. **No size limits** - Could be used to proxy large files
  4. **No domain allowlist** - Could proxy malicious content

**Affected File:** `app/api/image-proxy/route.ts`

**Recommendations:**
```typescript
// 1. Add domain allowlist
const ALLOWED_DOMAINS = [
  'polymarket.com',
  'cdn.polymarket.com',
  // Add other trusted domains
];

// 2. Add size limit (e.g., 5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// 3. Restrict CORS to specific origins
'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://yourdomain.com',

// 4. Add content-type validation
if (!contentType.startsWith('image/')) {
  return new NextResponse('URL does not point to an image', { status: 400 });
}
```

### 4. Screenshot API Security Issues ❌
- **Severity:** HIGH
- **Finding:**
  1. **No HTML size limit** - Could receive massive HTML payloads
  2. **No HTML sanitization** - Could execute malicious scripts
  3. **Puppeteer resource exhaustion** - No limits on concurrent requests
  4. **Error messages expose internal details**

**Affected File:** `app/api/screenshot/route.ts`

**Recommendations:**
```typescript
// 1. Add HTML size limit
const MAX_HTML_SIZE = 500 * 1024; // 500KB
if (html.length > MAX_HTML_SIZE) {
  return NextResponse.json(
    { error: 'HTML content too large' },
    { status: 400 }
  );
}

// 2. Sanitize HTML (use DOMPurify or similar)
import DOMPurify from 'isomorphic-dompurify';
const sanitizedHtml = DOMPurify.sanitize(html);

// 3. Add request queue/limit
// Use a semaphore or queue to limit concurrent Puppeteer instances

// 4. Generic error messages
catch (error) {
  console.error('[Screenshot API] Error:', error);
  return NextResponse.json(
    { error: 'Failed to generate screenshot' }, // Don't expose details
    { status: 500 }
  );
}
```

### 5. Information Disclosure via Console Logs ❌
- **Severity:** MEDIUM
- **Finding:** **Excessive console.log statements expose sensitive information**
- **Examples:**
  - Wallet addresses logged: `console.log('[API /pnl] Resolving proxy wallet for: ${wallet}')`
  - URLs logged: `console.log('[Image Proxy] Fetching:', url)`
  - Internal errors exposed: Error messages include stack traces

**Recommendation:**
- Remove or sanitize console.log statements in production
- Use environment-based logging:
```typescript
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  console.log('[API /pnl] Resolving proxy wallet for:', wallet);
}
// In production, only log errors, not user data
```

### 6. Missing Input Sanitization ❌
- **Severity:** MEDIUM
- **Finding:** **No sanitization of user inputs**
- **Examples:**
  - Username input not sanitized (could contain XSS payloads)
  - Wallet addresses not validated (format check only)
  - HTML content in screenshot API not sanitized

**Recommendation:**
- Add input sanitization for all user inputs
- Validate wallet address format: `/^0x[a-fA-F0-9]{40}$/`
- Sanitize usernames: Remove special characters, limit length
- Sanitize HTML content before processing

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 7. No Authentication/Authorization ⚠️
- **Severity:** MEDIUM
- **Finding:** All API endpoints are publicly accessible
- **Risk:** 
  - Resource abuse
  - No user tracking/accountability
  - Potential cost escalation

**Recommendation:**
- Consider adding API key authentication for sensitive endpoints
- Implement IP-based rate limiting as minimum
- Add request signing for critical operations

### 8. Error Messages Expose Internal Details ⚠️
- **Severity:** MEDIUM
- **Finding:** Error responses include internal error details
- **Examples:**
  ```typescript
  // app/api/resolve-username/route.ts
  return NextResponse.json(
    { error: 'Failed to resolve username', details: error.message }, // Exposes internal details
    { status: 500 }
  );
  ```

**Recommendation:**
- Return generic error messages to clients
- Log detailed errors server-side only
- Use error codes instead of messages for client handling

### 9. No Request Timeout Limits ⚠️
- **Severity:** MEDIUM
- **Finding:** Some API routes don't have explicit timeout limits
- **Risk:** Long-running requests could exhaust resources

**Recommendation:**
- Add timeout limits to all external API calls
- Set maximum execution time for API routes (e.g., 30 seconds)
- Use AbortController for fetch requests (already done in some places ✅)

---

## 📋 RECOMMENDATIONS SUMMARY

### Immediate Actions (Critical)
1. ✅ **Add Zod validation to ALL API routes**
2. ✅ **Implement rate limiting** (use `@upstash/ratelimit` or Vercel Edge Config)
3. ✅ **Fix image proxy security** (domain allowlist, size limits, CORS)
4. ✅ **Add HTML size limits and sanitization to screenshot API**
5. ✅ **Remove/sanitize console.log statements** in production

### Short-term Actions (High Priority)
6. ✅ **Add input sanitization** for all user inputs
7. ✅ **Generic error messages** (don't expose internal details)
8. ✅ **Add request timeout limits** to all API routes
9. ✅ **Implement request queuing** for Puppeteer (screenshot API)

### Long-term Actions (Nice to Have)
10. ✅ **Consider API key authentication** for sensitive endpoints
11. ✅ **Add monitoring/alerting** for suspicious activity
12. ✅ **Implement request logging** (without sensitive data)
13. ✅ **Add health check endpoints** for monitoring

---

## 📊 COMPLIANCE SCORECARD

| Rule Category | Status | Score |
|--------------|--------|-------|
| Backend-First Data Access | ✅ Compliant | 100% |
| Input Validation (Zod) | ❌ Missing | 0% |
| Rate Limiting | ❌ Missing | 0% |
| Security Best Practices | ⚠️ Partial | 40% |
| Error Handling | ⚠️ Needs Improvement | 50% |
| **Overall** | ⚠️ **Needs Improvement** | **38%** |

---

## 🔍 FILES REQUIRING CHANGES

### High Priority
1. `app/api/pnl/route.ts` - Add Zod validation
2. `app/api/image-proxy/route.ts` - Add security restrictions
3. `app/api/screenshot/route.ts` - Add size limits and sanitization
4. `app/api/resolve-username/route.ts` - Add Zod validation
5. `app/api/activities/route.ts` - Add Zod validation
6. `app/api/trades/route.ts` - Add Zod validation

### Medium Priority
7. All API routes - Remove/sanitize console.log statements
8. All API routes - Generic error messages
9. All API routes - Add rate limiting middleware

---

## 📝 NOTES

- **No Supabase/Storage Usage:** Since the app doesn't use Supabase, rules about RLS, storage security, and signed URLs don't apply.
- **No Payment/Webhook Handlers:** No payment processing found, so webhook signature verification rules don't apply.
- **No Environment Variables Exposed:** No hardcoded secrets found in codebase ✅
- **External API Dependencies:** App depends on Polymarket APIs, which are external and not under our control.

---

## ✅ NEXT STEPS

1. Create implementation plan for critical fixes
2. Prioritize fixes based on risk assessment
3. Implement fixes in `audit` branch
4. Test all changes thoroughly
5. Review and merge to `main`

---

**End of Audit Report**
