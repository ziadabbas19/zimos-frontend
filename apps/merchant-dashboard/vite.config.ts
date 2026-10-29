import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // React and the router in a file of their own: every page needs them,
          // and they change only when the packages are upgraded, so a deploy of
          // the dashboard leaves this file (and its name) as it was and the
          // browser keeps it from the last visit.
          groups: [
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/,
              priority: 20,
            },
            // The icons the pages use, in one file instead of one small file
            // per icon (a hundred requests for the frame alone otherwise).
            {
              name: 'icons',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend so the browser talks same-origin — the
    // backend's CORS allowlist only includes the storefront (:3000), not this
    // Vite dev server. With VITE_API_BASE_URL=/api/v1 (see .env) requests hit
    // this proxy instead. `/uploads` is proxied too so product images (served
    // by the backend with Cross-Origin-Resource-Policy: same-origin) load
    // through the same origin instead of being blocked.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
