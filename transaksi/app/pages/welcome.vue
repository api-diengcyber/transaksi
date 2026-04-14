<script setup>
definePageMeta({ layout: 'blank' }); 

const { public: { appName } } = useRuntimeConfig();
const router = useRouter();

const storeService = useStoreService();
const storeSettings = ref({});
const latestStore = ref(null);
const storeExists = ref(true);

const welcomeCookie = useCookie('has_seen_welcome', {
  maxAge: 60 * 60 * 24 * 365 
});

// State untuk mengontrol slide yang aktif
const activePage = ref(0);

const slides = ref([
  {
    title: "Selamat Datang di " + (appName || 'Aplikasi'),
    description: "Solusi manajemen transaksi modern, cepat, dan akurat untuk mengembangkan bisnis Anda.",
    icon: "pi-shop",
    colorAccent: "bg-primary-500", 
    iconColor: "text-primary-600 dark:text-primary-400"
  },
  {
    title: "Manajemen Inventori",
    description: "Pantau stok barang, proses opname, dan riwayat mutasi secara real-time dari mana saja.",
    icon: "pi-box",
    colorAccent: "bg-blue-500",
    iconColor: "text-blue-600 dark:text-blue-400"
  },
  {
    title: "Laporan Keuangan",
    description: "Analisis laba rugi, pantau arus kas, dan cetak laporan komprehensif hanya dengan satu klik.",
    icon: "pi-chart-line",
    colorAccent: "bg-teal-500",
    iconColor: "text-teal-600 dark:text-teal-400"
  }
]);

const finishWelcome = async () => {
  welcomeCookie.value = '1';
  await navigateTo('/login');
};

const checkStoreStatus = async () => {
    try {
        const response = await storeService.getSetupStatus();
        const data = response?.data || response;
        
        if (data.exists && data.store) {
            storeExists.value = true;
            latestStore.value = data.store;

            // Transformasi array settings menjadi Object
            if (data.store.settings && Array.isArray(data.store.settings)) {
                const mapped = {};
                data.store.settings.forEach(s => {
                    mapped[s.key] = s.value;
                });
                storeSettings.value = mapped;
            }

            // Terapkan warna tema dinamis ke CSS Variable agar komponen PrimeVue ikut berubah
            if (storeSettings.value.theme_primary_color) {
                const color = storeSettings.value.theme_primary_color.startsWith('#') 
                    ? storeSettings.value.theme_primary_color 
                    : `#${storeSettings.value.theme_primary_color}`;
                
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary-600', color);
            } else {
                document.documentElement.style.setProperty('--primary-color', "#2563eb");
                document.documentElement.style.setProperty('--primary-600', "#2563eb");
            }
        } else {
            document.documentElement.style.setProperty('--primary-color', "#2563eb");
            document.documentElement.style.setProperty('--primary-600', "#2563eb");
            storeExists.value = false;
        }
    } catch (error) {
        document.documentElement.style.setProperty('--primary-color', "#2563eb");
        document.documentElement.style.setProperty('--primary-600', "#2563eb");
        console.error('Gagal memuat status toko:', error);
        storeExists.value = false;
    }
};

onMounted(() => {
    checkStoreStatus();
});
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-900 font-sans flex flex-col justify-center">

    <Carousel 
      v-model:page="activePage"
      :value="slides" 
      :numVisible="1" 
      :numScroll="1" 
      :circular="false" 
      :showNavigators="false"
      class="h-screen w-full custom-carousel"
    >
      <template #item="slotProps">
        <div class="flex flex-col items-center justify-center h-screen px-4 w-full max-w-2xl mx-auto">
          
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full p-8 md:p-12 text-center relative overflow-hidden">
            
            <div :class="['absolute top-0 left-0 w-full h-2', slotProps.data.colorAccent]"></div>
            
            <div class="flex items-center justify-center w-24 h-24 rounded-full mx-auto mb-8 bg-slate-50 dark:bg-slate-700/50">
              <i :class="['pi text-5xl drop-shadow-sm', slotProps.data.icon, slotProps.data.iconColor]"></i>
            </div>
            
            <h1 class="text-2xl md:text-3xl font-bold mb-4 text-slate-800 dark:text-slate-100 tracking-tight">
              {{ slotProps.data.title }}
            </h1>
            <p class="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
              {{ slotProps.data.description }}
            </p>
            
            <div class="h-14 flex items-center justify-between w-full mt-2 border-t border-slate-100 dark:border-slate-700/50 pt-6">
              
              <Button 
                v-if="slides.indexOf(slotProps.data) > 0" 
                label="Kembali" 
                icon="pi pi-arrow-left" 
                text 
                severity="secondary" 
                @click="activePage--" 
              />
              <Button 
                v-else 
                label="Lewati" 
                text 
                severity="secondary" 
                class="!text-slate-400"
                @click="finishWelcome" 
              />

              <Button 
                v-if="slides.indexOf(slotProps.data) < slides.length - 1" 
                label="Lanjut" 
                icon="pi pi-arrow-right" 
                iconPos="right" 
                text 
                @click="activePage++" 
              />
              <Button 
                v-else 
                label="Mulai Sekarang" 
                icon="pi pi-check" 
                class="px-6 font-semibold shadow-md"
                @click="finishWelcome" 
              />
              
            </div>

          </div>

        </div>
      </template>
    </Carousel>
  </div>
</template>

<style scoped>
.custom-carousel :deep(.p-carousel-content) {
  height: 100vh;
}
.custom-carousel :deep(.p-carousel-item) {
  display: flex;
  align-items: center;
  justify-content: center;
}
.custom-carousel :deep(.p-carousel-indicators) {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  gap: 0.5rem;
}
.custom-carousel :deep(.p-carousel-indicator button) {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #cbd5e1; 
  transition: all 0.3s ease;
}
.custom-carousel :deep(.p-carousel-indicator.p-highlight button) {
  background-color: var(--p-primary-500);
  transform: scale(1.3);
}
.dark .custom-carousel :deep(.p-carousel-indicator button) {
  background-color: #475569;
}
.dark .custom-carousel :deep(.p-carousel-indicator.p-highlight button) {
  background-color: var(--p-primary-400);
}
</style>