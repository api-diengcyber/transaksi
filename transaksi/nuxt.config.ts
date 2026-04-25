// nuxt.config.ts
import Aura from '@primeuix/themes/aura';
import pkg from './package.json'

export default defineNuxtConfig({
  compatibilityDate: '2025-12-01',
  devtools: { enabled: false },
  ssr: false,
  app: {
    baseURL: '',
    cdnURL: '',
    // buildAssetsDir: 'assets', // The folder name for the built site assets, relative to baseURL (or cdnURL if set). This is set at build time and should not be customized at runtime.
    head: {
      script: [
        {
          innerHTML: `(function() {
            const color = localStorage.getItem('nuxt-color-mode') || 'light';
            if (color === 'dark') document.documentElement.classList.add('dark');
          })()`
        }
      ]
    }
  },
  router: {
    options: {
      hashMode: true
    }
  },
  devServer: {
    port: parseInt(process.env.PORT || process.env.NITRO_PORT || '3001', 10),
    host: process.env.NITRO_HOST || '0.0.0.0'
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
      appVersion: pkg.version || '1.0.0',
      appName: pkg.name || 'Transaksi'
    }
  },
  modules: [
    '@primevue/nuxt-module',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@nuxtjs/color-mode'
  ],
  colorMode: {
    preference: 'system', 
    fallback: 'light',
    classPrefix: '',
    classSuffix: '',
    storageKey: 'nuxt-color-mode'
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