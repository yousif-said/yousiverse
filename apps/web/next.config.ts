import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@yousiverse/api", "@yousiverse/auth", "@yousiverse/db", "@yousiverse/ui"],
};

export default nextConfig;
