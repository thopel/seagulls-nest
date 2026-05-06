import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default {
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: true
  },
  plugins: [
    vue(),
    basicSsl(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Le nid des mouettes',
        short_name: 'Nid des mouettes',
        description: 'Meteo, marees et sorties a Dinard dans une ambiance Animal Crossing.',
        theme_color: '#f5e4b8',
        background_color: '#f9f1d7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'fr',
        icons: [
          {
            src: '/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,png,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'openweather-cache'
            }
          },
          {
            urlPattern: /^https:\/\/openweathermap\.org\/img\/wn\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openweather-icons'
            }
          },
          {
            urlPattern: /^https:\/\/api-maree\.fr\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'maree-cache'
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
}
