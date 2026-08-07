import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

function lanLocalIpAddress(): string {
  const fromEnv = (process.env.LAN_LOCAL_IP_ADDRESS ?? "").trim();
  if (fromEnv) return fromEnv;
  const rootEnv = resolve(process.cwd(), "../../.env");
  if (!existsSync(rootEnv)) return "";
  const match = readFileSync(rootEnv, "utf8").match(/^LAN_LOCAL_IP_ADDRESS=(.*)$/m);
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const lan = lanLocalIpAddress();

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: {},
  transpilePackages: ["@monorepo/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      ...(lan ? [{ protocol: "http" as const, hostname: lan }] : []),
    ],
    formats: ["image/webp", "image/avif"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
