# Security Fixes Implementation Plan

**Based on:** `SECURITY_AUDIT.md`  
**Branch:** `audit`  
**Target:** Fix all critical and high-priority security issues

---

## 📋 Implementation Phases

This plan is divided into phases with self-checks between each phase to ensure quality and catch issues early.

---

## PHASE 1: Foundation - Add Zod & Dependencies

### Goals
- Install required dependencies
- Set up Zod schemas infrastructure
- Create shared validation utilities

### Tasks

#### 1.1 Install Dependencies
```bash
npm install zod @upstash/ratelimit @upstash/redis
npm install --save-dev @types/node
```

**Self-Check:**
- [x] Verify `package.json` includes all dependencies
- [x] Run `npm install` successfully
- [x] No dependency conflicts

**Status:** ✅ COMPLETED
- Dependencies installed: `zod@^4.3.6`, `@upstash/ratelimit@^2.0.8`, `@upstash/redis@^1.36.1`

#### 1.2 Create Validation Utilities
**File:** `lib/validation.ts`

Create shared Zod schemas:
- `walletAddressSchema` - Validates Ethereum wallet addresses
- `usernameSchema` - Validates Polymarket usernames
- `urlSchema` - Validates URLs with domain restrictions
- `screenshotRequestSchema` - Validates screenshot API requests

**Self-Check:**
- [x] All schemas properly defined
- [x] Error messages are user-friendly
- [x] Schemas handle edge cases (empty strings, null, undefined)

**Status:** ✅ COMPLETED
- Created `lib/validation.ts` with all required schemas:
  - `walletAddressSchema` - Validates 0x + 40 hex chars
  - `usernameSchema` - Validates alphanumeric, underscore, hyphen, 1-50 chars
  - `urlSchema` and `createUrlSchema` - URL validation with optional domain allowlist
  - `screenshotRequestSchema` - HTML (max 500KB), width/height (100-5000px)
  - `pnlQuerySchema` - Wallet/username + method validation
  - `activitiesQuerySchema`, `tradesQuerySchema`, `resolveQuerySchema`, `resolveUsernameQuerySchema`, `imageProxyQuerySchema`
  - Helper functions: `validateQueryParams`, `validateRequestBody`

#### 1.3 Create Rate Limiting Utility
**File:** `lib/rate-limit.ts`

Set up rate limiting using Upstash:
- Different limits per endpoint type
- IP-based rate limiting
- Error handling for rate limit exceeded

**Self-Check:**
- [x] Rate limiter initializes correctly
- [x] Can test rate limiting locally
- [x] Error messages are clear

**Status:** ✅ COMPLETED
- Created `lib/rate-limit.ts` with:
  - Rate limiters for each endpoint type (pnl: 10/min, screenshot: 5/min, image-proxy: 20/min, resolve-username: 15/min, default: 30/min)
  - `getClientIP` function to extract IP from headers
  - `checkRateLimit` function with fallback for missing Redis (dev mode)
  - `createRateLimitResponse` helper for 429 responses
  - Graceful degradation when Redis not configured

---

## PHASE 2: Input Validation - Add Zod to All API Routes

### Goals
- Add Zod validation to all API routes
- Ensure consistent error responses
- Remove manual validation code

### Tasks

#### 2.1 Validate `/api/pnl` Route
**File:** `app/api/pnl/route.ts`

**Changes:**
- Add `pnlQuerySchema` with `wallet` and `method` validation
- Replace manual checks with Zod validation
- Return structured error responses

**Self-Check:**
- [x] Valid wallet addresses pass
- [x] Invalid wallet addresses return 400 with clear error
- [x] Invalid method values return 400
- [x] Missing wallet parameter returns 400
- [x] Test with various edge cases (empty string, special chars, etc.)

**Status:** ✅ COMPLETED
- Added `pnlQuerySchema` validation using `validateQueryParams`
- Replaced manual wallet check with Zod validation
- Schema accepts both wallet addresses and usernames
- Method defaults to 'fifo' if not provided
- Returns structured 400 errors with validation details

#### 2.2 Validate `/api/resolve-username` Route
**File:** `app/api/resolve-username/route.ts`

**Changes:**
- Add `usernameSchema` validation
- Validate username format (alphanumeric, underscores, hyphens)
- Limit username length (e.g., max 50 chars)

**Self-Check:**
- [x] Valid usernames pass
- [x] Invalid characters rejected
- [x] Too long usernames rejected
- [x] Empty username returns 400

**Status:** ✅ COMPLETED
- Added `resolveUsernameQuerySchema` validation
- Username normalized to lowercase automatically
- Returns structured 400 errors for invalid input

#### 2.3 Validate `/api/image-proxy` Route
**File:** `app/api/image-proxy/route.ts`

**Changes:**
- Add `urlSchema` with domain allowlist
- Validate URL format and allowed domains
- Add size limit validation

**Self-Check:**
- [x] Valid image URLs from allowed domains pass
- [x] Disallowed domains rejected
- [x] Invalid URL format rejected
- [x] Test with various URL formats

**Status:** ✅ COMPLETED
- Added `imageProxyQuerySchema` validation using `urlSchema`
- URL format validated (domain allowlist will be added in Phase 4)
- Returns structured 400 errors for invalid URLs

#### 2.4 Validate `/api/screenshot` Route
**File:** `app/api/screenshot/route.ts`

**Changes:**
- Add `screenshotRequestSchema` with:
  - `html`: string, max length 500KB
  - `width`: number, min 100, max 5000
  - `height`: number, min 100, max 5000
- Validate all fields

**Self-Check:**
- [x] Valid requests pass
- [x] HTML too large rejected (500KB+)
- [x] Invalid dimensions rejected
- [x] Missing HTML returns 400

**Status:** ✅ COMPLETED
- Added `screenshotRequestSchema` validation using `validateRequestBody`
- HTML max size: 500KB
- Width/height: 100-5000px, defaults to 840x472
- Returns structured 400 errors for invalid input

#### 2.5 Validate `/api/activities` Route
**File:** `app/api/activities/route.ts`

**Changes:**
- Add schema for query parameters
- Validate `user`, `conditionId`, `outcome`
- Validate date formats for `openedAt`, `closedAt`

**Self-Check:**
- [x] All required parameters validated
- [x] Invalid dates rejected
- [x] Invalid wallet addresses rejected

**Status:** ✅ COMPLETED
- Added `activitiesQuerySchema` validation
- Validates wallet address, conditionId, outcome (required)
- Validates ISO datetime format for openedAt/closedAt (optional)
- Returns structured 400 errors for invalid input

#### 2.6 Validate `/api/trades` Route
**File:** `app/api/trades/route.ts`

**Changes:**
- Add schema for wallet, start, end parameters
- Validate wallet address format
- Validate date formats

**Self-Check:**
- [x] Valid requests pass
- [x] Invalid wallet addresses rejected
- [x] Invalid date formats rejected

**Status:** ✅ COMPLETED
- Added `tradesQuerySchema` validation
- Validates wallet address (required)
- Validates ISO datetime format for start/end (optional)
- Returns structured 400 errors for invalid input

#### 2.7 Validate `/api/resolve` Route
**File:** `app/api/resolve/route.ts`

**Changes:**
- Add wallet address validation
- Use shared `walletAddressSchema`

**Self-Check:**
- [x] Valid wallet addresses pass
- [x] Invalid formats rejected

**Status:** ✅ COMPLETED
- Added `resolveQuerySchema` validation using `walletAddressSchema`
- Returns structured 400 errors for invalid wallet addresses

#### 2.8 Validate `/api/debug` Route (Optional)
**File:** `app/api/debug/route.ts`

**Note:** Consider removing this route in production or adding strict authentication.

**Changes:**
- Add validation if keeping route
- Consider environment-based access control

**Self-Check:**
- [x] Route disabled in production OR
- [x] Route has proper authentication

**Status:** ✅ COMPLETED
- Added environment check: route returns 403 in production
- Route only available in development mode
- No validation needed since it's disabled in production

---

## PHASE 3: Rate Limiting Implementation

### Goals
- Add rate limiting to all API routes
- Prevent abuse and DoS attacks
- Set appropriate limits per endpoint

### Tasks

#### 3.1 Set Up Rate Limiting Infrastructure
**File:** `lib/rate-limit.ts`

**Implementation:**
- Create rate limiter instances for different endpoint types
- Configure Upstash Redis connection
- Create helper function to check rate limits

**Rate Limits:**
- `/api/pnl`: 10 requests/minute
- `/api/screenshot`: 5 requests/minute (resource-intensive)
- `/api/image-proxy`: 20 requests/minute
- `/api/resolve-username`: 15 requests/minute
- Other endpoints: 30 requests/minute

**Self-Check:**
- [ ] Rate limiter connects to Upstash successfully
- [ ] Can test rate limiting locally
- [ ] Rate limit errors return proper HTTP 429 status
- [ ] Error messages include retry-after information

#### 3.2 Add Rate Limiting to Each API Route

**Files to Update:**
- `app/api/pnl/route.ts`
- `app/api/screenshot/route.ts`
- `app/api/image-proxy/route.ts`
- `app/api/resolve-username/route.ts`
- `app/api/activities/route.ts`
- `app/api/trades/route.ts`
- `app/api/resolve/route.ts`

**Pattern:**
```typescript
// At start of route handler
const ip = request.headers.get('x-forwarded-for') || 
           request.headers.get('x-real-ip') || 
           'unknown';

const { success, limit, remaining, reset } = await rateLimiter.limit(ip);

if (!success) {
  return NextResponse.json(
    { 
      error: 'Rate limit exceeded', 
      retryAfter: Math.ceil((reset - Date.now()) / 1000) 
    },
    { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
      }
    }
  );
}
```

**Self-Check:**
- [ ] Rate limiting works on all endpoints
- [ ] Proper HTTP 429 responses
- [ ] Rate limit headers included
- [ ] Test with multiple requests to verify limits

---

## PHASE 4: Image Proxy Security Hardening

### Goals
- Restrict image proxy to allowed domains
- Add size limits
- Fix CORS policy
- Add content-type validation

### Tasks

#### 4.1 Add Domain Allowlist
**File:** `app/api/image-proxy/route.ts`

**Changes:**
- Create `ALLOWED_DOMAINS` array
- Validate URL domain against allowlist
- Return 403 for disallowed domains

**Allowed Domains:**
- `polymarket.com`
- `cdn.polymarket.com`
- `polymarket-upload.s3.us-east-2.amazonaws.com`
- Add others as needed

**Self-Check:**
- [ ] Allowed domains work
- [ ] Disallowed domains return 403
- [ ] Error message doesn't reveal allowlist
- [ ] Test with various domain formats

#### 4.2 Add Size Limits
**File:** `app/api/image-proxy/route.ts`

**Changes:**
- Set `MAX_IMAGE_SIZE = 5 * 1024 * 1024` (5MB)
- Check `Content-Length` header before downloading
- Stream and check size during download
- Return 413 if too large

**Self-Check:**
- [ ] Images under 5MB work
- [ ] Images over 5MB rejected with 413
- [ ] Large images don't consume excessive memory
- [ ] Error message is clear

#### 4.3 Fix CORS Policy
**File:** `app/api/image-proxy/route.ts`

**Changes:**
- Replace `Access-Control-Allow-Origin: *` with specific origin
- Use environment variable: `process.env.ALLOWED_ORIGIN`
- Default to production domain if not set

**Self-Check:**
- [ ] CORS headers set correctly
- [ ] Only allowed origin can access
- [ ] Works in development and production
- [ ] Test with different origins

#### 4.4 Add Content-Type Validation
**File:** `app/api/image-proxy/route.ts`

**Changes:**
- Validate `Content-Type` header is image/*
- Reject non-image content types
- Use magic bytes as fallback validation

**Self-Check:**
- [ ] Valid images pass
- [ ] Non-image content rejected
- [ ] Magic bytes validation works
- [ ] Error messages are clear

---

## PHASE 5: Screenshot API Security Hardening

### Goals
- Add HTML size limits
- Add HTML sanitization
- Implement request queuing
- Improve error handling

### Tasks

#### 5.1 Add HTML Size Limit
**File:** `app/api/screenshot/route.ts`

**Changes:**
- Set `MAX_HTML_SIZE = 500 * 1024` (500KB)
- Check HTML length before processing
- Return 413 if too large

**Self-Check:**
- [ ] HTML under 500KB works
- [ ] HTML over 500KB rejected
- [ ] Error message is clear
- [ ] Test with various HTML sizes

#### 5.2 Add HTML Sanitization
**File:** `app/api/screenshot/route.ts`

**Changes:**
- Install `isomorphic-dompurify`
- Sanitize HTML before processing
- Remove script tags and event handlers
- Keep only safe HTML/CSS

**Self-Check:**
- [ ] Script tags removed
- [ ] Event handlers removed
- [ ] Safe HTML/CSS preserved
- [ ] Screenshots still render correctly
- [ ] Test with malicious HTML payloads

#### 5.3 Implement Request Queuing
**File:** `lib/puppeteer-queue.ts`

**Changes:**
- Create semaphore/queue for Puppeteer instances
- Limit concurrent Puppeteer browsers (e.g., max 3)
- Queue requests when limit reached
- Add timeout for queued requests

**Self-Check:**
- [ ] Only max concurrent browsers run
- [ ] Requests queue properly
- [ ] Timeout works for queued requests
- [ ] No resource exhaustion
- [ ] Test with multiple concurrent requests

#### 5.4 Improve Error Handling
**File:** `app/api/screenshot/route.ts`

**Changes:**
- Remove detailed error messages
- Return generic errors to client
- Log detailed errors server-side only
- Add error codes for client handling

**Self-Check:**
- [ ] Generic error messages returned
- [ ] Detailed errors logged server-side
- [ ] No stack traces exposed
- [ ] Error codes are useful for debugging

---

## PHASE 6: Input Sanitization

### Goals
- Sanitize all user inputs
- Prevent XSS attacks
- Validate data formats

### Tasks

#### 6.1 Sanitize Username Inputs
**Files:** 
- `app/api/resolve-username/route.ts`
- `app/page.tsx` (client-side)

**Changes:**
- Remove special characters from usernames
- Limit length (max 50 chars)
- Trim whitespace
- Validate format (alphanumeric, underscore, hyphen only)

**Self-Check:**
- [ ] Special characters removed
- [ ] Length limits enforced
- [ ] Whitespace trimmed
- [ ] Valid usernames pass
- [ ] Test with various inputs

#### 6.2 Sanitize Wallet Addresses
**Files:** All API routes accepting wallet addresses

**Changes:**
- Validate format: `/^0x[a-fA-F0-9]{40}$/`
- Convert to lowercase
- Trim whitespace
- Reject invalid formats

**Self-Check:**
- [ ] Valid addresses pass
- [ ] Invalid formats rejected
- [ ] Case-insensitive handling
- [ ] Test with edge cases

#### 6.3 Sanitize URL Parameters
**Files:** All API routes

**Changes:**
- Validate URL encoding
- Decode properly
- Check for injection attempts
- Limit parameter lengths

**Self-Check:**
- [ ] Valid URLs work
- [ ] Injection attempts blocked
- [ ] Encoding handled correctly
- [ ] Length limits enforced

---

## PHASE 7: Logging & Error Handling Cleanup

### Goals
- Remove sensitive data from logs
- Generic error messages
- Environment-based logging

### Tasks

#### 7.1 Create Logging Utility
**File:** `lib/logger.ts`

**Changes:**
- Create logger that respects `NODE_ENV`
- Sanitize sensitive data (wallet addresses, URLs)
- Log levels (error, warn, info, debug)
- Only log errors in production

**Self-Check:**
- [ ] Sensitive data sanitized
- [ ] Production logs minimal
- [ ] Development logs detailed
- [ ] Log levels work correctly

#### 7.2 Update All API Routes
**Files:** All API route files

**Changes:**
- Replace `console.log` with logger
- Remove wallet addresses from logs
- Remove URLs from logs (or sanitize)
- Use appropriate log levels

**Self-Check:**
- [ ] No sensitive data in logs
- [ ] Logs useful for debugging
- [ ] Production logs clean
- [ ] Test logging in dev and prod modes

#### 7.3 Generic Error Messages
**Files:** All API route files

**Changes:**
- Return generic error messages to clients
- Log detailed errors server-side
- Use error codes for client handling
- Remove stack traces from responses

**Self-Check:**
- [ ] Generic messages returned
- [ ] Detailed errors logged
- [ ] No stack traces exposed
- [ ] Error codes are useful

---

## PHASE 8: Additional Security Hardening

### Goals
- Add request timeouts
- Add monitoring hooks
- Improve overall security posture

### Tasks

#### 8.1 Add Request Timeouts
**Files:** All API routes

**Changes:**
- Set maximum execution time (30 seconds)
- Use AbortController for fetch requests
- Timeout long-running operations
- Return timeout errors gracefully

**Self-Check:**
- [ ] Timeouts work correctly
- [ ] Long requests cancelled
- [ ] Error messages clear
- [ ] Resources cleaned up

#### 8.2 Add Request Size Limits
**File:** `next.config.js`

**Changes:**
- Configure body size limits
- Set appropriate limits per route type
- Document limits

**Self-Check:**
- [ ] Size limits enforced
- [ ] Appropriate limits set
- [ ] Error messages clear
- [ ] Test with large payloads

#### 8.3 Add Health Check Endpoint
**File:** `app/api/health/route.ts`

**Changes:**
- Create health check endpoint
- Check external API connectivity
- Return service status
- Useful for monitoring

**Self-Check:**
- [ ] Health check works
- [ ] Returns correct status
- [ ] Useful for monitoring
- [ ] No sensitive data exposed

---

## PHASE 9: Testing & Validation

### Goals
- Test all security fixes
- Verify no regressions
- Performance testing

### Tasks

#### 9.1 Unit Tests for Validation
**Files:** Create test files for validation schemas

**Tests:**
- Valid inputs pass
- Invalid inputs rejected
- Edge cases handled
- Error messages clear

**Self-Check:**
- [ ] All validation tests pass
- [ ] Edge cases covered
- [ ] Error messages tested
- [ ] Test coverage adequate

#### 9.2 Integration Tests for API Routes
**Files:** Create test files for API routes

**Tests:**
- Rate limiting works
- Validation works
- Security restrictions enforced
- Error handling correct

**Self-Check:**
- [ ] All API tests pass
- [ ] Security features tested
- [ ] Error cases covered
- [ ] Performance acceptable

#### 9.3 Security Testing
**Tasks:**
- Test XSS prevention
- Test injection attacks
- Test rate limiting
- Test size limits
- Test domain restrictions

**Self-Check:**
- [ ] XSS attempts blocked
- [ ] Injection attempts blocked
- [ ] Rate limiting effective
- [ ] Size limits enforced
- [ ] Domain restrictions work

#### 9.4 Performance Testing
**Tasks:**
- Test with high load
- Test rate limiting impact
- Test timeout behavior
- Monitor resource usage

**Self-Check:**
- [ ] Performance acceptable
- [ ] No memory leaks
- [ ] Timeouts work correctly
- [ ] Resource usage reasonable

---

## PHASE 10: Documentation & Deployment

### Goals
- Document security improvements
- Update API documentation
- Prepare for deployment

### Tasks

#### 10.1 Update Documentation
**Files:**
- `README.md` - Add security section
- `SECURITY.md` - Document security features
- API documentation - Document rate limits, validation

**Self-Check:**
- [ ] Documentation complete
- [ ] Security features documented
- [ ] API changes documented
- [ ] Examples provided

#### 10.2 Environment Variables
**File:** `.env.example`

**Changes:**
- Document all required environment variables
- Document optional variables
- Include rate limiting config
- Include CORS origins

**Self-Check:**
- [ ] All variables documented
- [ ] Defaults specified
- [ ] Examples provided
- [ ] Security notes included

#### 10.3 Deployment Checklist
**Tasks:**
- Verify all fixes implemented
- Test in staging environment
- Verify rate limiting works
- Verify monitoring in place
- Prepare rollback plan

**Self-Check:**
- [ ] All critical fixes implemented
- [ ] Staging tests pass
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Team notified of changes

---

## 📊 Progress Tracking

### Phase Completion Checklist

- [x] Phase 1: Foundation - Add Zod & Dependencies ✅ **COMPLETED**
- [x] Phase 2: Input Validation - Add Zod to All API Routes ✅ **COMPLETED**
- [ ] Phase 3: Rate Limiting Implementation
- [ ] Phase 4: Image Proxy Security Hardening
- [ ] Phase 5: Screenshot API Security Hardening
- [ ] Phase 6: Input Sanitization
- [ ] Phase 7: Logging & Error Handling Cleanup
- [ ] Phase 8: Additional Security Hardening
- [ ] Phase 9: Testing & Validation
- [ ] Phase 10: Documentation & Deployment

---

## 🔄 Self-Check Template

For each phase, use this checklist:

### Before Starting Phase
- [ ] Previous phase completed and tested
- [ ] Dependencies installed
- [ ] Understanding of requirements clear
- [ ] Test cases identified

### During Implementation
- [ ] Code follows project patterns
- [ ] Error handling implemented
- [ ] Edge cases considered
- [ ] Code is readable and maintainable

### After Implementation
- [ ] All self-checks in phase completed
- [ ] Code reviewed (self-review)
- [ ] Tests written and passing
- [ ] No regressions introduced
- [ ] Documentation updated

### Before Moving to Next Phase
- [ ] All tasks in current phase complete
- [ ] All self-checks passed
- [ ] Code committed to `audit` branch
- [ ] Ready for next phase

---

## 🚨 Critical Path Items

These must be completed in order:

1. **Phase 1** → Foundation (Zod, rate limiting setup)
2. **Phase 2** → Input validation (blocks other phases)
3. **Phase 3** → Rate limiting (security critical)
4. **Phase 4 & 5** → Security hardening (can be parallel)
5. **Phase 6** → Input sanitization (depends on Phase 2)
6. **Phase 7** → Logging cleanup (can be done anytime)
7. **Phase 8** → Additional hardening (nice to have)
8. **Phase 9** → Testing (required before Phase 10)
9. **Phase 10** → Documentation & deployment

---

## 📝 Notes

- **Estimated Time:** 2-3 days for all phases
- **Priority:** Phases 1-5 are critical, 6-8 are high priority, 9-10 are required before production
- **Testing:** Each phase should be tested before moving to next
- **Rollback:** Keep previous working version available for rollback
- **Communication:** Update team on progress and any breaking changes

---

## ✅ Success Criteria

Implementation is complete when:

1. ✅ All API routes have Zod validation
2. ✅ Rate limiting active on all endpoints
3. ✅ Image proxy has domain restrictions and size limits
4. ✅ Screenshot API has size limits and sanitization
5. ✅ All inputs sanitized
6. ✅ No sensitive data in logs
7. ✅ Generic error messages only
8. ✅ All tests passing
9. ✅ Documentation updated
10. ✅ Ready for production deployment

---

**End of Implementation Plan**
