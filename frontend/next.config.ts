import type { NextConfig } from 'next';

const backendBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.INTERNAL_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: false,

  // Performance: compress responses
  compress: true,

  // Faster builds + better tree-shaking
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Proxy all /api/* calls to Express backend
  async rewrites() {
    return [
      {
        source:      '/api/:path*',
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },

  // Security + caching headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Static assets — cache aggressively
        source: '/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
