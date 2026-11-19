/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["mongoose", "bcryptjs"],
  async rewrites() {
    return {
      // Files uploaded after `next build` aren't in Next's static manifest, so in production
      // they fall through to this route, which streams them from public/uploads/books.
      fallback: [
        { source: "/uploads/books/:file", destination: "/api/uploads/books/:file" },
        { source: "/uploads/settings/:file", destination: "/api/uploads/settings/:file" },
        { source: "/uploads/returns/:file", destination: "/api/uploads/returns/:file" },
      ],
    };
  },
};
export default nextConfig;
