#!/bin/bash

# Script to add environment variables to Vercel
# Usage: ./scripts/add-vercel-env.sh

echo "🔐 Vercel Environment Variables Setup"
echo "======================================"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it with: npm i -g vercel"
    exit 1
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel. Run: vercel login"
    exit 1
fi

echo "✅ Logged in as: $(vercel whoami)"
echo ""

# Get project name/scope
read -p "Enter your Vercel project name (or press Enter to auto-detect): " PROJECT_NAME

if [ -z "$PROJECT_NAME" ]; then
    echo "Auto-detecting project..."
    PROJECT_NAME="poly-pnl"
fi

echo ""
echo "📝 Please provide the following values:"
echo ""

# Get UPSTASH_REDIS_REST_URL
read -p "UPSTASH_REDIS_REST_URL (from https://console.upstash.com/): " UPSTASH_URL
if [ -n "$UPSTASH_URL" ]; then
    echo "Adding UPSTASH_REDIS_REST_URL..."
    vercel env add UPSTASH_REDIS_REST_URL production <<< "$UPSTASH_URL" 2>&1
    vercel env add UPSTASH_REDIS_REST_URL preview <<< "$UPSTASH_URL" 2>&1
    echo "✅ Added UPSTASH_REDIS_REST_URL"
fi

echo ""

# Get UPSTASH_REDIS_REST_TOKEN
read -p "UPSTASH_REDIS_REST_TOKEN (from https://console.upstash.com/): " UPSTASH_TOKEN
if [ -n "$UPSTASH_TOKEN" ]; then
    echo "Adding UPSTASH_REDIS_REST_TOKEN..."
    vercel env add UPSTASH_REDIS_REST_TOKEN production <<< "$UPSTASH_TOKEN" 2>&1
    vercel env add UPSTASH_REDIS_REST_TOKEN preview <<< "$UPSTASH_TOKEN" 2>&1
    echo "✅ Added UPSTASH_REDIS_REST_TOKEN"
fi

echo ""

# Get ALLOWED_ORIGIN
read -p "ALLOWED_ORIGIN (your Vercel domain, e.g., https://poly-pnl.vercel.app): " ALLOWED_ORIGIN
if [ -n "$ALLOWED_ORIGIN" ]; then
    echo "Adding ALLOWED_ORIGIN..."
    vercel env add ALLOWED_ORIGIN production <<< "$ALLOWED_ORIGIN" 2>&1
    vercel env add ALLOWED_ORIGIN preview <<< "$ALLOWED_ORIGIN" 2>&1
    echo "✅ Added ALLOWED_ORIGIN"
fi

echo ""
echo "✅ Environment variables added!"
echo ""
echo "📋 Summary:"
vercel env ls production 2>&1 | grep -E "(UPSTASH|ALLOWED)" || echo "Run 'vercel env ls production' to verify"
echo ""
echo "🔄 Next step: Redeploy your project for changes to take effect"
echo "   Run: vercel --prod"
echo "   Or push a new commit to trigger auto-deployment"
