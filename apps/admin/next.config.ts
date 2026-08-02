import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  turbopack: {},
  transpilePackages: ["@monorepo/shared"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui.shadcn.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/home",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },

  // API traffic goes through `app/api/**` BFF/proxy routes (JWT cookie → Bearer).
};

export default nextConfig;
