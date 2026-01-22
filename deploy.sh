#!/bin/bash

# Vercel Deployment Script
# This script automates deployment and fixes common errors

set -e

echo "🚀 Starting deployment process..."

# Step 1: Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: Not on main branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 2: Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Committing them..."
    git add .
    git commit -m "Auto-commit before deployment"
fi

# Step 3: Build locally to catch errors early
echo "🔨 Building project locally to check for errors..."
if npm run build; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
fi

# Step 4: Push to GitHub (triggers Vercel auto-deploy)
echo "📤 Pushing to GitHub..."
if git push origin main; then
    echo "✅ Pushed to GitHub successfully!"
    echo "🔗 Check your Vercel dashboard for deployment status:"
    echo "   https://vercel.com/dashboard"
    echo ""
    echo "📋 Common issues to check:"
    echo "   1. Build logs in Vercel dashboard"
    echo "   2. Environment variables (if needed)"
    echo "   3. Function size limits (Puppeteer might be large)"
    echo "   4. Build timeout (increase if needed in Vercel settings)"
else
    echo "❌ Failed to push to GitHub"
    exit 1
fi

echo "✅ Deployment process completed!"
