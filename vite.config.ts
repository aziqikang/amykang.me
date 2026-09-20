import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const distDir = fileURLToPath(new URL('./dist', import.meta.url))

/**
 * GitHub Pages has no server-side rewrite, so a hard refresh on /art
 * would 404. Pages does serve 404.html for unknown paths, so shipping a
 * copy of index.html there lets React Router resolve the route on load.
 * Without this every URL except "/" breaks when opened directly.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      copyFileSync(`${distDir}/index.html`, `${distDir}/404.html`)
    },
  }
}

export default defineConfig({
  // Custom domain (amykang.me), so the site is served from the root,
  // not from a /repo-name/ subpath.
  base: '/',
  plugins: [react(), spaFallback()],
  resolve: {
    alias: { '@': srcDir },
  },
  server: {
    port: 5173,
    open: true,
  },
})
