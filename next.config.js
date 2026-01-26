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
}

module.exports = nextConfig
