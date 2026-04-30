// ─────────────────────────────────────────────────────────────────────────────
// NEXT.JS CONFIG — PWA + Headers de sécurité + CSP
// ─────────────────────────────────────────────────────────────────────────────

// @ts-check
import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Requis pour Dockerfile: genere .next/standalone
  output: "standalone",

  // @react-pdf/renderer utilise yoga-layout (WASM) — ne pas bundler côté serveur
  experimental: {
    serverComponentsExternalPackages: [
      "@react-pdf/renderer",
      "@zxing/browser",
      "@zxing/library",
    ],
  },

  // Optimisation des images
  images: {
    domains: [],
    formats: ["image/avif", "image/webp"],
  },

  // Headers de sécurité globaux
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval requis par Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.ngrok-free.app https://*.ngrok.io",
              "media-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      // Headers spécifiques aux documents PDF
      {
        source: "/api/documents/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // Rewrites pour les assets statiques des documents
  async rewrites() {
    return [];
  },

  // Variables d'environnement exposées au client
  env: {
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Gestion Commerciale",
  },
};

// Configuration PWA (Progressive Web App)
const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // Cache des pages de l'app
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "app-cache",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 heures
        },
      },
    },
    // Cache des assets statiques
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|woff|woff2)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
        },
      },
    },
    // Cache des appels API en lecture (GET)
    {
      urlPattern: /^\/api\/(produits|clients)(\?.*)?$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
