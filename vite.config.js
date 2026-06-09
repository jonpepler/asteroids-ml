import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The NEAT engine now lives in src/lib/neat (a self-contained, typed package),
// so there is no longer an untyped carrot dependency to alias or patch.

// Served from https://jonpepler.github.io/asteroids-ml/, so every asset and
// route is namespaced under this base path. The router basename must match.
export const basePath = '/asteroids-ml/'

// GitHub Pages is a static host with no SPA rewrite, so a deep link or refresh
// to e.g. /asteroids-ml/play would 404. Serving the app shell as 404.html lets
// the client router take over and render the right route.
const spaFallback = () => ({
  name: 'spa-404-fallback',
  closeBundle() {
    const dir = fileURLToPath(new URL('./dist', import.meta.url))
    copyFileSync(`${dir}/index.html`, `${dir}/404.html`)
  }
})

export default defineConfig({
  base: basePath,
  // The geometry libraries (polygon -> vec2 -> line2 -> segseg) are CommonJS and
  // guard their imports with `if (typeof require !== 'undefined')`. In the ES
  // module eval worker that guard can be skipped, leaving `Vec2` undefined so
  // Vec2.fromArray throws and training stalls. Pre-bundling them to ESM (the same
  // treatment dev uses) resolves the requires up front, in the worker too.
  optimizeDeps: {
    include: ['polygon', 'vec2', 'line2', 'segseg', 'point-in-polygon']
  },
  worker: {
    format: 'es'
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'],
      manifest: {
        name: 'asteroids-ml',
        short_name: 'asteroids-ml',
        description: 'A machine learning algorithm that plays Asteroids.',
        background_color: '#663399',
        theme_color: '#663399',
        display: 'minimal-ui',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    spaFallback()
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts']
    }
  }
})
