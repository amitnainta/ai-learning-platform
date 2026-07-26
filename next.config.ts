import type { NextConfig } from "next";

// Security headers applied at the app layer as defense-in-depth on top of
// host-level TLS termination (Vercel auto-provisions certs and redirects
// HTTP -> HTTPS at the edge). See docs/architecture/infrastructure.md for
// the full rationale (NFR-SEC-002).
const securityHeaders = [
  {
    // Force HTTPS for this origin (and subdomains) for a year, and allow
    // browsers to preload it into their HSTS list.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Prevent browsers from MIME-sniffing a response away from its
    // declared Content-Type.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Disallow this site from being framed by anyone (clickjacking
    // defense). frame-ancestors 'none' is the modern CSP equivalent;
    // X-Frame-Options is kept for older browser support.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'",
  },
  {
    // Only send the origin (not the full URL/path) on cross-origin
    // requests; send the full referrer for same-origin requests.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
