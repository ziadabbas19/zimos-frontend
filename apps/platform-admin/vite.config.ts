import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // As in the merchant dashboard: a font file is never written into the
    // stylesheet as data. The small .woff fallbacks of the shared
    // @store-builder/ui/fonts.css (for browsers without woff2) would otherwise make the
    // render-blocking CSS heavier for nobody.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  server: {
    port: 5174,
    // Proxy API calls to the backend so the browser talks same-origin — the
    // backend's CORS allowlist does not include this Vite dev server. With
    // VITE_API_BASE_URL=/api/v1 (see .env) requests hit this proxy instead.
    // `/uploads` is proxied so backend-served media loads same-origin, and
    // `/health` so the System health page can probe the backend's root-level
    // liveness/readiness endpoints in development.
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})
