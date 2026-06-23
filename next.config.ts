import type { NextConfig } from "next";

const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Keep Turbopack scoped to this application even if parent folders contain
  // unrelated lockfiles. This prevents file watching/build root spillover.
  turbopack: {
    root: process.cwd(),
  },

  // allowedDevOrigins only applies in development (next dev).
  // On Vercel it's irrelevant — the app is served over HTTPS from a real domain.
  ...(!isVercel && {
    allowedDevOrigins: [
      "192.168.1.*", // most home routers
      "192.168.0.*", // alternate home range
      "10.*.*.*",    // VPN / corporate networks
      "172.16.*.*",  // another common VPN range
    ],
  }),
};

export default nextConfig;
