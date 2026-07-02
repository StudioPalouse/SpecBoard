/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. CSP uses `unsafe-inline`
// for scripts/styles because Next injects inline bootstrap without nonces;
// tightening to a nonce-based policy is a follow-up. `frame-ancestors 'none'`
// (plus X-Frame-Options) blocks clickjacking of the authenticated app.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://avatars.githubusercontent.com https://*.githubusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@specboard/core", "@specboard/db", "@specboard/ui"],
  // Set NEXT_OUTPUT=standalone for the Docker image (infra/web.Dockerfile);
  // plain `next start` doesn't support standalone output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
