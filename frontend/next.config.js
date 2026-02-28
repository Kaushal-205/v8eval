/** @type {import('next').NextConfig} */
const nextConfig = {
  // Rewrites proxy backend API calls to the FastAPI server on EigenCompute.
  // /api/waitlist is handled by Next.js API route (not proxied).
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/models',
        destination: `${backendUrl}/api/models`,
      },
      {
        source: '/api/runs',
        destination: `${backendUrl}/api/runs`,
      },
      {
        source: '/api/run',
        destination: `${backendUrl}/api/run`,
      },
      {
        source: '/api/stream/:path*',
        destination: `${backendUrl}/api/stream/:path*`,
      },
      {
        source: '/api/result/:path*',
        destination: `${backendUrl}/api/result/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
