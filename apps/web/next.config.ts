import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sidebar's foot is at the bottom left, where the development badge would cover it.
  devIndicators: { position: "bottom-right" },
  transpilePackages: [
    "@yousiverse/api",
    "@yousiverse/auth",
    "@yousiverse/db",
    "@yousiverse/email",
    "@yousiverse/integrations",
    "@yousiverse/ui",
  ],
};

export default nextConfig;
