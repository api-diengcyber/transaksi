// plugins/sync-theme.client.ts
export default defineNuxtPlugin(() => {
  const colorMode = useColorMode()
  
  // Perhatikan perubahan class secara manual jika automatic detection gagal di Electron
  watch(() => colorMode.value, (newMode) => {
    if (process.client) {
      if (newMode === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, { immediate: true })
})