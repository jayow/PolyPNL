/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image optimization settings for external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: false,
  },
  // Ensure API routes work correctly
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude Puppeteer from server bundle (causes build-time issues)
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
  // Exclude Puppeteer browser files from build tracing
  outputFileTracingExcludes: {
    '*': [
      '**/node_modules/puppeteer/**',
      '**/node_modules/@puppeteer/**',
      '**/.cache/puppeteer/**',
    ],
  },
}

module.exports = nextConfig
