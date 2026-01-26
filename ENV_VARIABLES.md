# Environment Variables Guide

## Overview

This document explains what each environment variable does and whether it's required.

## Environment Variables

### 1. `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`

**Purpose:** Rate limiting protection using Upstash Redis

**What it does:**
- Enables distributed rate limiting across all API endpoints
- Prevents abuse and DoS attacks
- Limits requests per IP address per minute

**Required?** ⚠️ **Recommended for production, but NOT strictly required**

**What happens if missing:**
- Rate limiting is **disabled**
- All requests are **allowed** (no limits)
- Warning messages logged: `[Rate Limit] Rate limiting disabled - Redis not configured`
- **App still works**, but vulnerable to abuse

**How to get:**
1. Sign up at https://console.upstash.com/
2. Create a Redis database
3. Copy the REST URL and Token from the dashboard

**Example:**
```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxx...
```

---

### 2. `ALLOWED_ORIGIN`

**Purpose:** CORS (Cross-Origin Resource Sharing) configuration for image proxy

**What it does:**
- Restricts which domains can access the `/api/image-proxy` endpoint
- Prevents unauthorized sites from using your image proxy

**Required?** ⚠️ **Recommended for production, but NOT strictly required**

**What happens if missing:**
- CORS defaults to `*` (allows **all origins**)
- **App still works**, but less secure
- Any website can use your image proxy endpoint

**In development:**
- Automatically defaults to `http://localhost:3000`

**Example:**
```bash
ALLOWED_ORIGIN=https://yourdomain.com
```

---

### 3. `NODE_ENV`

**Purpose:** Environment mode (development vs production)

**What it does:**
- Controls logging verbosity (detailed in dev, minimal in prod)
- Enables/disables debug endpoints
- Affects error message detail

**Required?** ✅ **Automatically set by deployment platforms**

**What happens if missing:**
- Defaults to `development` mode
- More verbose logging
- Debug endpoints enabled

**Example:**
```bash
NODE_ENV=production
```

---

## Summary

| Variable | Required? | What Happens If Missing |
|----------|-----------|-------------------------|
| `UPSTASH_REDIS_REST_URL` | ⚠️ Recommended | Rate limiting disabled, app works but vulnerable |
| `UPSTASH_REDIS_REST_TOKEN` | ⚠️ Recommended | Rate limiting disabled, app works but vulnerable |
| `ALLOWED_ORIGIN` | ⚠️ Recommended | CORS allows all origins, less secure |
| `NODE_ENV` | ✅ Auto-set | Defaults to development mode |

## Current Status

**✅ You can deploy without any environment variables** - the app will work, but:
- No rate limiting (vulnerable to abuse)
- CORS allows all origins (less secure)
- More verbose logging

**⚠️ For production, you should configure:**
- Upstash Redis for rate limiting (free tier available)
- `ALLOWED_ORIGIN` for CORS security

## Quick Setup for Production

1. **Get Upstash Redis (Free):**
   - Go to https://console.upstash.com/
   - Create account (free tier available)
   - Create Redis database
   - Copy REST URL and Token

2. **Set ALLOWED_ORIGIN:**
   - Set to your production domain
   - Example: `https://poly-pnl.vercel.app`

3. **Add to Vercel/Deployment Platform:**
   - Go to Settings → Environment Variables
   - Add all three variables
   - Redeploy

## Testing Without Environment Variables

The app works fine without these variables for:
- ✅ Local development
- ✅ Testing
- ✅ Small-scale deployments

But for production with real users, you should configure them for security.
