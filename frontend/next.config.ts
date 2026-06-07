import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* API proxy handled by src/app/api/v1/[...path]/route.ts */
  // Tell Next.js not to bundle @qvac/sdk — it uses native Node.js modules
  // and must run as-is in the server-side Node.js process.
  serverExternalPackages: ["@qvac/sdk"],
};
export default nextConfig;
