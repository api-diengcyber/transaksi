// nuxt.config.ts
import Aura from '@primeuix/themes/aura';

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: true,
  devServer: {
    port: 3001,
    host: '0.0.0.0'
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000'
    }
  },
  modules: [
    '@primevue/nuxt-module',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
  ],
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
  ]
})