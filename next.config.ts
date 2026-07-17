import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller runtime image for Dokploy (build happens in CI, not on the VPS)
  output: "standalone",
};

export default nextConfig;
