/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // SRS 3.4: the conductor screen must open with no network at the bus
    // door. The service worker precaches the built app shell + assets, so a
    // reload offline still boots; the conductor's data comes from IndexedDB.
    // API calls are never cached here (network-only) — offline data is the
    // app's own explicit cache, never a stale HTTP response.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "fonts/*"],
      manifest: {
        name: "BBMS — Bus Ticket Booking",
        short_name: "BBMS",
        start_url: "/",
        display: "standalone",
        background_color: "#F5F7F9",
        theme_color: "#0D5F6E",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,ttf}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/locales/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "bbms-locales" },
          },
        ],
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3's own scss still uses the legacy color functions
        // Dart Sass is deprecating — noise from a dependency we don't own,
        // not from our code, so silence it rather than patching Bootstrap.
        quietDeps: true,
        silenceDeprecations: ["color-functions", "import", "global-builtin"],
      },
    },
  },
  preview: {
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/media": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      // Uploaded media (bus photos) — Django serves MEDIA_URL in dev.
      "/media": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
