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
  // API route configuration
  api: {
    bodyParser: {
      sizeLimit: '2mb', // Maximum request body size
    },
    responseLimit: '8mb', // Maximum response size
  },
}

module.exports = nextConfig
