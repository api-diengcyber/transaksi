<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRuntimeConfig, useColorMode, useCookie } from '#imports';

// Ambil config & state
const { public: { apiBase, appVersion, appName } } = useRuntimeConfig();
const colorMode = useColorMode();
const route = useRoute();
const router = useRouter();

const isApiReady = ref(false);
const isWelcomeChecked = ref(false); 
const apiError = ref(null);
const progress = ref(0);

// Format nama aplikasi menjadi huruf kapital
const displayAppName = (appName || 'Aplikasi').replace(/-/g, ' ').toUpperCase();

// Logika Pengecekan Initial
const checkInitialFlow = () => {
  const welcomeCookie = useCookie('has_seen_welcome');
  
  // Jika ini adalah halaman welcome, biarkan dia render, jangan jalankan loading API
  if (route.path === '/welcome') {
      isWelcomeChecked.value = false;
      isApiReady.value = true; // Anggap "ready" agar NuxtLayout bisa ngerender welcome page
      return;
  }

  // Jika bukan halaman welcome, pastikan cookie sudah 1 (Middleware sebenarnya sudah handle ini)
  if (welcomeCookie.value === '1') {
      isWelcomeChecked.value = true;
      checkApiStatus();
  }
};

// Logika Pengecekan API Backend (Hanya jalan setelah Welcome)
const checkApiStatus = async () => {
  apiError.value = null;
  progress.value = 20; 
  
  try {
    const interval = setInterval(() => {
      if (progress.value < 90) progress.value += 10;
    }, 400);

    await $fetch(`${apiBase}/system/status`, { 
      method: 'GET',
      timeout: 3000 
    });

    clearInterval(interval);
    progress.value = 100;

    setTimeout(() => {
      isApiReady.value = true;
    }, 500);

  } catch (err) {
    progress.value = 0;
    isApiReady.value = false;
    apiError.value = "Gagal terhubung ke server. Pastikan layanan backend aktif.";
    
    setTimeout(checkApiStatus, 5000);
  }
};

// Pantau perubahan rute (Jika user dari welcome klik "Mulai Sekarang" ke /login)
watch(() => route.path, (newPath) => {
    const welcomeCookie = useCookie('has_seen_welcome');
    // Jika user pindah rute DARI welcome KE rute lain, dan cookie sudah 1
    if (newPath !== '/welcome' && welcomeCookie.value === '1' && !isWelcomeChecked.value) {
        isWelcomeChecked.value = true;
        isApiReady.value = false; // Reset ready untuk memunculkan splash screen
        checkApiStatus();
    }
});

// Sinkronisasi Class Dark Mode
watch(() => colorMode.value, (newMode) => {
  if (process.client) {
    if (newMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}, { immediate: true })

onMounted(() => {
  checkInitialFlow();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
    
    <Transition name="fade">
      <div v-if="!isApiReady && isWelcomeChecked" class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        
        <div class="mb-6 relative">
          <div class="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
             <i class="pi pi-box text-5xl text-primary-500"></i> 
          </div>
        </div>

        <h1 class="text-2xl font-bold tracking-tight mb-2 uppercase">{{ displayAppName }}</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">v{{ appVersion }}</p>

        <div class="w-64">
          <ProgressBar :value="progress" :showValue="false" style="height: 6px"></ProgressBar>
        </div>
        
        <p v-if="apiError" class="mt-4 text-xs text-red-500 text-center px-4">{{ apiError }}</p>
      </div>
    </Transition>

    <div v-if="!isWelcomeChecked || isApiReady">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.fade-leave-active {
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-leave-to {
  opacity: 0;
}
:deep(.p-progressbar) { background: #e2e8f0; }
:deep(.dark .p-progressbar) { background: #334155; }
:deep(.p-progressbar-value) { background: var(--p-primary-500); transition: width 0.4s ease-in-out; }
</style>