<script setup>
// Ambil config & state termasuk appName
const { public: { apiBase, appVersion, appName } } = useRuntimeConfig();
const colorMode = useColorMode();
const router = useRouter(); // <-- Tambahan router

const isApiReady = ref(false);
const isWelcomeChecked = ref(false); // <-- Tambahan state welcome
const apiError = ref(null);
const progress = ref(0);

// Format nama aplikasi menjadi huruf kapital (opsional)
const displayAppName = appName.replace(/-/g, ' ').toUpperCase();

// Ambil cookie untuk pengecekan welcome page
const welcomeCookie = useCookie('has_seen_welcome');

// Logika Pengecekan Initial (Welcome atau Main App)
const checkInitialFlow = () => {
  // Jika nilai cookie bukan '1', arahkan ke halaman welcome
  if (welcomeCookie.value !== '1') {
    router.push('/welcome');
    return; // Hentikan eksekusi agar tidak perlu cek API dulu
  }
  
  // Jika sudah pernah welcome, tandai checked dan mulai cek API
  isWelcomeChecked.value = true;
  checkApiStatus();
};

// Logika Pengecekan API
const checkApiStatus = async () => {
  apiError.value = null;
  progress.value = 20; // Mulai loading
  
  try {
    // Simulasi progress agar smooth
    const interval = setInterval(() => {
      if (progress.value < 90) progress.value += 10;
    }, 400);

    await $fetch(`${apiBase}/system/status`, { 
      method: 'GET',
      timeout: 3000 
    });

    clearInterval(interval);
    progress.value = 100;

    // Beri jeda sedikit agar user melihat bar penuh sebelum masuk
    setTimeout(() => {
      isApiReady.value = true;
    }, 500);

  } catch (err) {
    progress.value = 0;
    isApiReady.value = false;
    apiError.value = "Gagal terhubung ke server. Pastikan layanan backend aktif.";
    
    // Coba lagi otomatis setelah 5 detik
    setTimeout(checkApiStatus, 5000);
  }
};

// Sinkronisasi Class Dark Mode (Penting agar background splash screen sesuai)
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
  checkInitialFlow(); // <-- Ubah panggilan awal ke checkInitialFlow
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
/* ... style Anda tetap sama ... */
.fade-leave-active {
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-leave-to {
  opacity: 0;
}

:deep(.p-progressbar) {
  background: #e2e8f0; 
}
:deep(.dark .p-progressbar) {
  background: #334155; 
}
:deep(.p-progressbar-value) {
  background: var(--p-primary-500); 
  transition: width 0.4s ease-in-out;
}
</style>