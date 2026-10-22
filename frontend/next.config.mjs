/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_HOSTPORT ? `http://${process.env.BACKEND_HOSTPORT}` : (process.env.BACKEND_URL || "http://127.0.0.1:8000")

const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "1"

const nextConfig = {
  output: "standalone",
  distDir: demo ? ".next" : process.env.NEXT_DIST_DIR || ".next",
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  async rewrites() {
    if (demo) return []
    return ["api", "media", "admin", "static"].map(prefix => ({
      source: `/${prefix}/:path*`,
      destination: `${backend}/${prefix}/:path*${["api", "admin"].includes(prefix) ? "/" : ""}`,
    }))
  },
}

export default nextConfig
