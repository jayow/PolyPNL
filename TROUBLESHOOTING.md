# Troubleshooting Guide

## Issue: localhost failed / npm install errors

If you're seeing npm permission errors or the server won't start, try these solutions:

### Solution 1: Use Yarn instead of npm

If npm has permission issues, try using yarn:

```bash
# Install yarn if you don't have it
npm install -g yarn

# Install dependencies
yarn install

# Run dev server
yarn dev
```

### Solution 2: Fix npm permissions

Try using a Node version manager or fixing npm permissions:

```bash
# Option A: Use nvm to manage Node versions
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Option B: Install dependencies without sudo (not recommended but works)
npm install --prefix ./
```

### Solution 3: Manual dependency check

Make sure you have:
- Node.js 18+ installed (`node --version`)
- npm or yarn working (`npm --version` or `yarn --version`)

### Solution 4: Check for port conflicts

If localhost:3000 is already in use:

```bash
# Kill process on port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or run on a different port
npm run dev -- -p 3001
```

### Solution 5: Clear cache and reinstall

```bash
# Remove node_modules and lock files
rm -rf node_modules package-lock.json yarn.lock

# Clear npm cache
npm cache clean --force

# Reinstall
npm install
```

### Solution 6: Check for error messages

Run with verbose output:

```bash
npm run dev -- --verbose
```

Common errors:
- **Module not found**: Run `npm install`
- **Port already in use**: Kill the process on port 3000 or use a different port
- **Syntax errors**: Check the terminal for specific file/line errors

### If nothing works

Make sure all required files are present:
- ✅ package.json
- ✅ next.config.js
- ✅ tsconfig.json
- ✅ tailwind.config.ts
- ✅ postcss.config.js
- ✅ app/ directory with page.tsx and layout.tsx

If files are missing, the project structure may be incomplete.
