#!/usr/bin/env node

/**
 * Interactive script to add Vercel environment variables
 * Usage: node scripts/add-env.js
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔐 Vercel Environment Variables Setup\n');
  
  // Get project name
  const projectName = await question('Enter your Vercel project name (e.g., poly-pnl): ');
  if (!projectName) {
    console.log('❌ Project name is required');
    process.exit(1);
  }

  console.log('\n📝 Please provide the following values:\n');

  // Get UPSTASH_REDIS_REST_URL
  const upstashUrl = await question('UPSTASH_REDIS_REST_URL (from https://console.upstash.com/): ');
  if (upstashUrl) {
    console.log('Adding UPSTASH_REDIS_REST_URL to production...');
    try {
      execSync(`echo "${upstashUrl}" | vercel env add UPSTASH_REDIS_REST_URL production --scope ${projectName}`, { stdio: 'inherit' });
      execSync(`echo "${upstashUrl}" | vercel env add UPSTASH_REDIS_REST_URL preview --scope ${projectName}`, { stdio: 'inherit' });
      console.log('✅ Added UPSTASH_REDIS_REST_URL\n');
    } catch (error) {
      console.log('⚠️  Error adding UPSTASH_REDIS_REST_URL (may already exist)\n');
    }
  }

  // Get UPSTASH_REDIS_REST_TOKEN
  const upstashToken = await question('UPSTASH_REDIS_REST_TOKEN (from https://console.upstash.com/): ');
  if (upstashToken) {
    console.log('Adding UPSTASH_REDIS_REST_TOKEN to production...');
    try {
      execSync(`echo "${upstashToken}" | vercel env add UPSTASH_REDIS_REST_TOKEN production --scope ${projectName}`, { stdio: 'inherit' });
      execSync(`echo "${upstashToken}" | vercel env add UPSTASH_REDIS_REST_TOKEN preview --scope ${projectName}`, { stdio: 'inherit' });
      console.log('✅ Added UPSTASH_REDIS_REST_TOKEN\n');
    } catch (error) {
      console.log('⚠️  Error adding UPSTASH_REDIS_REST_TOKEN (may already exist)\n');
    }
  }

  // Get ALLOWED_ORIGIN
  const allowedOrigin = await question('ALLOWED_ORIGIN (your Vercel domain, e.g., https://poly-pnl.vercel.app): ');
  if (allowedOrigin) {
    console.log('Adding ALLOWED_ORIGIN to production...');
    try {
      execSync(`echo "${allowedOrigin}" | vercel env add ALLOWED_ORIGIN production --scope ${projectName}`, { stdio: 'inherit' });
      execSync(`echo "${allowedOrigin}" | vercel env add ALLOWED_ORIGIN preview --scope ${projectName}`, { stdio: 'inherit' });
      console.log('✅ Added ALLOWED_ORIGIN\n');
    } catch (error) {
      console.log('⚠️  Error adding ALLOWED_ORIGIN (may already exist)\n');
    }
  }

  console.log('\n✅ Done! Environment variables have been added.');
  console.log('\n🔄 Next step: Redeploy your project for changes to take effect');
  console.log('   Run: vercel --prod');
  console.log('   Or push a new commit to trigger auto-deployment\n');

  rl.close();
}

main().catch(console.error);
