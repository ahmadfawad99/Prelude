/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep heavy server-only deps out of the client bundle.
  serverExternalPackages: ["bullmq", "ioredis", "exceljs", "@prisma/client", "@anthropic-ai/sdk", "openai", "pdf-parse", "mammoth"],
};

export default nextConfig;
