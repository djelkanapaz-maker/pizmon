import type { NextConfig } from 'next';

// Cache Components is intentionally off: almost every screen is per-user, permission-checked
// data that must be read at request time. Data stays dynamic by default (previous caching model).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // the brief PDF is printed by headless Chromium in a serverless function
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/brief/pdf': ['./src/server/brief-pdf/fonts/**', './node_modules/@sparticuz/chromium/bin/**'],
  },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  async headers() {
    return [
      {
        source: '/:path((?!store-kit/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // the store-kit relay page is framed by the store consoles to hand them screenshots
        source: '/store-kit/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "frame-ancestors https://appstoreconnect.apple.com https://play.google.com" },
        ],
      },
    ];
  },
};

export default nextConfig;
