import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@yousiverse/api",
    "@yousiverse/auth",
    "@yousiverse/db",
    "@yousiverse/integrations",
    "@yousiverse/ui",
  ],
};

export default nextConfig;
