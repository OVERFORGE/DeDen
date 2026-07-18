// File: next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ ADD: Empty turbopack config to silence the warning
  turbopack: {},
  
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "**.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "www.prestigesouthernstar.info", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  
  // Exclude these from Next.js server bundling analysis
  serverExternalPackages: ["pino", "thread-stream"],

  env: {
    NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_ARBITRUM || "",
    NEXT_PUBLIC_ALCHEMY_API_KEY_BNB: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BNB || "",
    NEXT_PUBLIC_ALCHEMY_API_KEY_BASE: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE || "",
  },

  webpack: (config) => {
    // 1. Fix for WalletConnect/Pino
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // 2. Fix for MetaMask SDK (React Native issue)
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };

    return config;
  },
};

export default nextConfig;