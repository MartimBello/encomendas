import type { NextConfig } from "next";

const remoteDevelopmentHosts = (process.env.NEXT_DEV_ALLOWED_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

function configuredSupabaseSources() {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321");
    const websocketOrigin = new URL(origin);
    websocketOrigin.protocol = origin.protocol === "https:" ? "wss:" : "ws:";
    return `${origin.origin} ${websocketOrigin.origin}`;
  } catch {
    return "http://127.0.0.1:54321 ws://127.0.0.1:54321";
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", ...remoteDevelopmentHosts],
  async headers() {
    const isDevelopment = process.env.NODE_ENV !== "production";
    const scriptSrc = isDevelopment ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    const policy = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com ${configuredSupabaseSources()}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: policy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    serverActions: {
      allowedOrigins: remoteDevelopmentHosts,
    },
  },
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
