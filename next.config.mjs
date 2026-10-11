/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use 'standalone' for Docker: set BUILD_STANDALONE=1 or build with Dockerfile
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow WebSocket connections
  serverExternalPackages: ['ws', 'better-sqlite3'],
  // Proxy the audit trail viewer (HTTPS, self-signed; trusted via NODE_EXTRA_CA_CERTS).
  // Auth headers pass straight through, so the audit service still enforces its own login.
  async rewrites() {
    return [
      { source: '/audit-proxy', destination: 'https://127.0.0.1:4300/' },
      { source: '/audit-proxy/:path*', destination: 'https://127.0.0.1:4300/:path*' },
    ]
  },
}

export default nextConfig
