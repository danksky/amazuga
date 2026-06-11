import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "**": ["./public/fonts/**"],
  },
};

export default nextConfig;
