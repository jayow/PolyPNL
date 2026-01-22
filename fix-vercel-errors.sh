#!/bin/bash

# Vercel Error Fixer Script
# Automatically fixes common Vercel deployment errors

set -e

echo "🔧 Vercel Error Fixer"
echo "====================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Fix 1: Ensure Next.js config is correct
echo "📝 Checking Next.js configuration..."
if [ -f "next.config.js" ]; then
    echo "✅ next.config.js exists"
else
    echo "⚠️  Creating next.config.js..."
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig
EOF
fi

# Fix 2: Check for TypeScript errors
echo "🔍 Checking for TypeScript errors..."
if npm run build 2>&1 | grep -i "error\|failed"; then
    echo "⚠️  Build errors found. Checking common issues..."
    
    # Check for missing types
    if ! grep -q "@types/node" package.json; then
        echo "📦 Installing missing type definitions..."
        npm install --save-dev @types/node @types/react @types/react-dom
    fi
else
    echo "✅ No TypeScript errors found"
fi

# Fix 3: Check Puppeteer (common Vercel issue)
echo "🖼️  Checking Puppeteer configuration..."
if grep -q "puppeteer" package.json; then
    echo "⚠️  Puppeteer detected. Ensuring proper configuration..."
    
    # Check if screenshot route has proper runtime
    if [ -f "app/api/screenshot/route.ts" ]; then
        if ! grep -q "export const runtime = 'nodejs'" app/api/screenshot/route.ts; then
            echo "⚠️  Adding nodejs runtime to screenshot route..."
            # This would need manual fix - just warn
            echo "   ⚠️  Manual fix needed: Add 'export const runtime = \"nodejs\"' to app/api/screenshot/route.ts"
        else
            echo "✅ Screenshot route has correct runtime"
        fi
    fi
fi

# Fix 4: Check for large dependencies
echo "📊 Checking bundle size..."
BUNDLE_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 || echo "unknown")
echo "   Node modules size: $BUNDLE_SIZE"

# Fix 5: Ensure .gitignore is correct
echo "📋 Checking .gitignore..."
if [ ! -f ".gitignore" ]; then
    echo "⚠️  Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
EOF
fi

# Fix 6: Check environment variables
echo "🔐 Checking environment variables..."
if [ -f ".env.example" ]; then
    echo "✅ .env.example exists"
else
    echo "ℹ️  No .env.example found (this is OK if no env vars needed)"
fi

# Fix 7: Verify package.json scripts
echo "📜 Verifying package.json scripts..."
REQUIRED_SCRIPTS=("build" "start" "dev")
for script in "${REQUIRED_SCRIPTS[@]}"; do
    if grep -q "\"$script\"" package.json; then
        echo "   ✅ $script script exists"
    else
        echo "   ⚠️  Missing $script script in package.json"
    fi
done

echo ""
echo "✅ Error checking complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Check Vercel dashboard for deployment status"
echo "   2. Review build logs for specific errors"
echo "   3. Run 'npm run build' locally to catch errors early"
echo "   4. If Puppeteer causes issues, consider using puppeteer-core"
