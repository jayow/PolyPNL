# Vercel Environment Variables Setup Guide

## Required Environment Variables

Based on your `ENV_VARIABLES.md` and `.env.example`, you need to configure these in Vercel:

### 1. **UPSTASH_REDIS_REST_URL** (Recommended)
- **Purpose**: Rate limiting protection
- **Required**: ⚠️ Recommended for production
- **Get it from**: https://console.upstash.com/

### 2. **UPSTASH_REDIS_REST_TOKEN** (Recommended)
- **Purpose**: Rate limiting protection
- **Required**: ⚠️ Recommended for production
- **Get it from**: https://console.upstash.com/

### 3. **ALLOWED_ORIGIN** (Recommended)
- **Purpose**: CORS security for image proxy
- **Required**: ⚠️ Recommended for production
- **Value**: Your Vercel domain (e.g., `https://poly-pnl.vercel.app`)

### 4. **NODE_ENV** (Automatic)
- **Purpose**: Environment mode
- **Required**: ✅ Automatically set by Vercel to `production`

## How to Check/Set Environment Variables in Vercel

### Step 1: Access Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Find and click on your **PolyPNL** project

### Step 2: Navigate to Environment Variables
1. Click on **Settings** (top navigation)
2. Click on **Environment Variables** (left sidebar)

### Step 3: Check Current Variables
Look for these variables in the list:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ALLOWED_ORIGIN`

### Step 4: Add Missing Variables

#### For Rate Limiting (Upstash Redis):

1. **Get Upstash Credentials** (if you don't have them):
   - Go to https://console.upstash.com/
   - Sign up or log in
   - Create a new Redis database (free tier available)
   - Copy the **REST URL** and **REST Token**

2. **Add to Vercel**:
   - Click **Add New** in Environment Variables
   - **Key**: `UPSTASH_REDIS_REST_URL`
   - **Value**: Your Upstash REST URL (e.g., `https://xxx.upstash.io`)
   - **Environment**: Select **Production**, **Preview**, and **Development**
   - Click **Save**
   
   - Click **Add New** again
   - **Key**: `UPSTASH_REDIS_REST_TOKEN`
   - **Value**: Your Upstash REST Token
   - **Environment**: Select **Production**, **Preview**, and **Development**
   - Click **Save**

#### For CORS Security:

1. **Get Your Vercel Domain**:
   - Check your project's **Domains** section in Vercel
   - Or use your custom domain if configured
   - Example: `https://poly-pnl.vercel.app` or `https://yourdomain.com`

2. **Add to Vercel**:
   - Click **Add New** in Environment Variables
   - **Key**: `ALLOWED_ORIGIN`
   - **Value**: Your production domain (e.g., `https://poly-pnl.vercel.app`)
   - **Environment**: Select **Production** (and **Preview** if needed)
   - Click **Save**

### Step 5: Redeploy

After adding/updating environment variables:

1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic redeploy

**Important**: Environment variables are only applied to **new deployments**. Existing deployments won't have the new variables until you redeploy.

## Quick Checklist

- [ ] `UPSTASH_REDIS_REST_URL` is set in Vercel
- [ ] `UPSTASH_REDIS_REST_TOKEN` is set in Vercel
- [ ] `ALLOWED_ORIGIN` is set to your Vercel domain
- [ ] Variables are set for **Production** environment (at minimum)
- [ ] Project has been redeployed after adding variables

## What Happens Without These Variables?

The app **will still work**, but:

- ❌ **No rate limiting** - Vulnerable to abuse/DoS attacks
- ❌ **CORS allows all origins** - Any website can use your image proxy
- ⚠️ **More verbose logging** - Less optimized for production

## Verification

After setting variables and redeploying, check the deployment logs:

1. Go to **Deployments** → Latest deployment → **Build Logs**
2. Look for:
   - ✅ `[Rate Limit] Rate limiting enabled` (if Redis is configured)
   - ⚠️ `[Rate Limit] Rate limiting disabled - Redis not configured` (if not configured)

## Need Help?

- **Upstash Setup**: https://docs.upstash.com/redis
- **Vercel Environment Variables**: https://vercel.com/docs/concepts/projects/environment-variables
- **Project Documentation**: See `ENV_VARIABLES.md` for detailed explanations
