import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Street Tracker',
        short_name: 'Tracker',
        description: 'Osobisty dziennik treningów street workout i kalisteniki.',
        lang: 'pl',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#101418',
        background_color: '#101418',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // The first install must cache lazy chart chunks too, before they are visited.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
