import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow isolated preview/build checks alongside the normal development server.
  distDir: process.env.JAGUAR_BUILD_DIR || ".next",
};

export default nextConfig;
