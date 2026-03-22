import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  allowedDevOrigins: ['unplunderous-emerie-unrested.ngrok-free.dev'],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
