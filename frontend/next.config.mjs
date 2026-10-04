/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000"

const nextConfig = {
  output: "standalone",
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  async rewrites() {
    return ["api", "media", "admin", "static"].map(prefix => ({
      source: `/${prefix}/:path*`,
      destination: `${backend}/${prefix}/:path*${["api", "admin"].includes(prefix) ? "/" : ""}`,
    }))
  },
}

export default nextConfig
