import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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
  resolve: {
    alias: {
      // carrot's published `dist` files re-`require` sibling source paths that
      // don't exist next to them, so Rollup can't bundle them for the browser.
      // Point at the clean source (the `dist/index.min.js` entry resolves to it
      // anyway). A patch-package fix declares one undeclared `copyNetwork`
      // global in neat.js that otherwise throws under ESM strict mode.
      '@liquid-carrot/carrot': fileURLToPath(
        new URL('./node_modules/@liquid-carrot/carrot/src/index.js', import.meta.url)
      )
    }
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
