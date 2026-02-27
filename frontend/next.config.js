/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for EigenCompute Docker build.
  // On Vercel, STATIC_EXPORT is unset so Next.js runs in server mode with rewrites.
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export', trailingSlash: false } : {}),

  // Rewrites proxy /api/* to the FastAPI backend.
  // - Local dev:        BACKEND_URL=http://localhost:8000
  // - Vercel:           BACKEND_URL=http://34.73.123.230  (set in Vercel env vars)
  // - Docker/EigenCompute: static export, rewrites ignored (same-origin)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
