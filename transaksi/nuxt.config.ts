// nuxt.config.ts
import Aura from '@primeuix/themes/aura';

export default defineNuxtConfig({
  compatibilityDate: '2025-12-01',
  devtools: { enabled: false },
  ssr: false,
  app: {
    baseURL: '',
    cdnURL: '',
    // buildAssetsDir: 'assets' // The folder name for the built site assets, relative to baseURL (or cdnURL if set). This is set at build time and should not be customized at runtime.
  },
  router: {
    options: {
      hashMode: true
    }
  },
  devServer: {
    port: 3001,
    host: '0.0.0.0'
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://127.0.0.1:3000'
    }
  },
  modules: [
    '@primevue/nuxt-module',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@nuxtjs/color-mode'
  ],
  colorMode: {
    classSuffix: '',
    preference: 'system', 
    fallback: 'light'
  },
  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        }
      },
      ripple: true,
    },
    autoImport: true,
  },
  css: [
    'primeicons/primeicons.css',
    '~/assets/css/base.css'
  ],
  experimental: {
    payloadExtraction: false
  },
  nitro: {
    preset: 'static',
    serveStatic: true
  }
})