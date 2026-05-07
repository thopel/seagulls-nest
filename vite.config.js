import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const destinationConfig = JSON.parse(
  readFileSync(new URL('./src/data/destination.json', import.meta.url), 'utf8')
)
const packageConfig = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

const appConfig = destinationConfig.app
const devConfig = destinationConfig.development
const pwaConfig = destinationConfig.pwa

export default {
  define: {
    __APP_VERSION__: JSON.stringify(packageConfig.version)
  },
  server: {
    host: devConfig.host,
    port: devConfig.port,
    https: devConfig.https
  },
  plugins: [
    vue(),
    basicSsl(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: appConfig.name.fr,
        short_name: appConfig.shortName.fr,
        description: appConfig.metaDescription.fr,
        theme_color: appConfig.themeColor,
        background_color: appConfig.backgroundColor,
        display: pwaConfig.display,
        orientation: pwaConfig.orientation,
        start_url: pwaConfig.startUrl,
        lang: pwaConfig.lang,
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
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo-cache'
            }
          },
          {
            urlPattern: /^https:\/\/marine-api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo-marine-cache'
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
