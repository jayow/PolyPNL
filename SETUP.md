# Setup Instructions

## Problem Identified

**Issue**: `http://localhost:3000` is inaccessible because:
- ❌ Dependencies are NOT installed (`node_modules` missing)
- ❌ npm has permission errors preventing installation
- ✅ Node.js is installed (v24.4.1)
- ✅ npm is installed (v11.4.2)
- ✅ Port 3000 is free

## Solution: Install Dependencies

You need to install dependencies before the server can run. Here are your options:

### Option 1: Fix npm Permissions (Recommended)

Try fixing the npm permission issue:

```bash
cd "/Users/jakeolaso/Downloads/CursorAI Projects/Poly PNL"

# Check npm cache directory permissions
ls -la ~/.npm

# If that directory doesn't exist or has permission issues, create it:
mkdir -p ~/.npm
chmod 755 ~/.npm

# Clear npm cache
npm cache clean --force

# Try installing again
npm install
```

### Option 2: Use Yarn (If Available)

If yarn is installed, use it instead:

```bash
cd "/Users/jakeolaso/Downloads/CursorAI Projects/Poly PNL"

# Install dependencies with yarn
yarn install

# Run dev server
yarn dev
```

If yarn is not installed:

```bash
# Install yarn globally (using npm, but this might also fail)
npm install -g yarn

# Or install yarn using Homebrew (if you have it)
brew install yarn
```

### Option 3: Use npx (Bypass npm install)

You can try using npx to run Next.js directly:

```bash
cd "/Users/jakeolaso/Downloads/CursorAI Projects/Poly PNL"

# This will download and run Next.js without installing locally
npx next dev
```

### Option 4: Fix npm System-Wide (Advanced)

If the npm binary itself has permission issues:

```bash
# Check npm installation path
which npm
ls -la /opt/homebrew/lib/node_modules/npm/

# You may need to fix permissions on the npm installation
# This is a system-level fix - be careful!
sudo chown -R $(whoami) /opt/homebrew/lib/node_modules/npm/
```

### Option 5: Use a Node Version Manager

If you don't have nvm, install it:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source profile
source ~/.zshrc

# Install and use Node.js 20
nvm install 20
nvm use 20

# Now try npm install again
cd "/Users/jakeolaso/Downloads/CursorAI Projects/Poly PNL"
npm install
```

## After Installing Dependencies

Once dependencies are installed:

1. **Start the dev server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Open your browser:**
   Navigate to: `http://localhost:3000`

3. **Verify it's working:**
   You should see the Poly PNL home page with a wallet input form.

## Quick Checklist

Before running the server, ensure:
- [ ] `node_modules` directory exists (run `ls -la node_modules | head -5`)
- [ ] `node_modules/next` exists (run `ls -la node_modules/next | head -5`)
- [ ] No errors when running `npm run dev`

## Troubleshooting

**If port 3000 is already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or run on a different port
npm run dev -- -p 3001
# Then access: http://localhost:3001
```

**If you see module not found errors:**
- Dependencies aren't fully installed
- Try: `rm -rf node_modules package-lock.json && npm install`

**If npm still has permission errors:**
- Use Option 2 (yarn) or Option 5 (nvm) above
- Or manually fix npm permissions (Option 4)

## Next Steps

1. Try one of the solutions above to install dependencies
2. Once installed, run `npm run dev` or `yarn dev`
3. The server should start and show: "Ready on http://localhost:3000"
4. Open that URL in your browser

If you continue to have issues, please share:
- The exact error message you see
- Which installation method you tried
- Output of `npm --version` and `node --version`
