/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep heavy server-only deps out of the client bundle.
  serverExternalPackages: ["bullmq", "ioredis", "exceljs", "@prisma/client", "@anthropic-ai/sdk", "openai", "pdf-parse", "mammoth"],
  // Don't fail production builds on lint; types are still checked at build time
  // and `npm run lint` / `npm run typecheck` run in dev.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
