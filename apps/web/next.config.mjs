const apiOrigin = process.env.API_BASE_INTERNAL || 'http://127.0.0.1:3001';

/** @type {import('next').NextConfig} */
export default {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  poweredByHeader: false,
  devIndicators: false,
  // Dynamic article loading + extraction can exceed the default 30-second proxy limit.
  experimental: { proxyTimeout: 120_000 },
  // Keep API and upload URLs same-origin. The production server runs only Next.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
      ],
      afterFiles: [],
    };
  },
};
