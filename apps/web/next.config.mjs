const legacyOrigin = process.env.LEGACY_WEB_ORIGIN || 'http://127.0.0.1:4321';
const apiOrigin = process.env.API_BASE_INTERNAL || 'http://127.0.0.1:3001';

/** @type {import('next').NextConfig} */
export default {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  poweredByHeader: false,
  devIndicators: false,
  // Keep legacy URLs, cookies, storage origin and links intact during migration.
  // Only implemented Next routes win; everything else stays with the old site.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
      ],
      afterFiles: [],
      fallback: [{ source: '/:path*', destination: `${legacyOrigin}/:path*` }],
    };
  },
};
