/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  // Rewrites only apply during `next dev` — ignored for static export.
  // Proxies /api/* to the FastAPI backend running on port 8000.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}
module.exports = nextConfig
