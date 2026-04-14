<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'blank' });

const { public: { apiBase, appVersion, appName } } = useRuntimeConfig();

const displayAppName = (appName || 'Aplikasi').replace(/-/g, ' ').toUpperCase();

const authService = useAuthService();
const storeService = useStoreService();
const router = useRouter();
const toast = useToast();

// [BARU] Inject Color Mode dari Nuxt
const colorMode = useColorMode();

const loading = ref(false);
const form = reactive({ username: '', password: '' });
const storeSettings = ref({});
const latestStore = ref(null);
const storeExists = ref(true);

// --- STATE UNTUK MENU FAB ---
const systemMenu = ref();
const systemMenuItems = ref([
    {
        label: 'Cek Status Sistem',
        icon: 'pi pi-server',
        command: () => router.push('/system/status')
    },
    {
        label: 'Cek Log', 
        icon: 'pi pi-cloud', 
        command: () => router.push('/system/logs')
    },
    {
        label: 'Cek Database MySQL',
        icon: 'pi pi-database',
        command: () => router.push('/system/db-check')
    }
]);

const toggleSystemMenu = (event) => {
    systemMenu.value.toggle(event);
};

// [BARU] Fungsi Toggle Dark Mode
const toggleDarkMode = () => {
    if (colorMode.value === 'dark') {
        colorMode.preference = 'light';
    } else {
        colorMode.preference = 'dark';
    }
};

const isDark = computed(() => colorMode.value === 'dark');
// ----------------------------

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

const handleLogin = async () => {
    if (!form.username || !form.password) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Mohon lengkapi form login.', life: 3000 });
        return;
    }

    loading.value = true;
    try {
        const response = await authService.login({ username: form.username, password: form.password });
        localStorage.setItem('accessToken', response.accessToken);

        toast.add({ severity: 'success', summary: 'Login Berhasil', detail: 'Mengalihkan ke dashboard...', life: 2000 });
        setTimeout(() => router.push('/'), 800);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal Masuk', detail: 'Username atau sandi salah.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Helper untuk format hex color agar aman digunakan di inline style
const getThemeColor = (fallback) => {
    const color = storeSettings.value.theme_primary_color;
    if (!color) return fallback;
    return color.startsWith('#') ? color : `#${color}`;
};
</script>

<template>
    <div class="min-h-screen flex flex-col lg:flex-row bg-surface-50 dark:bg-surface-900 transition-colors duration-500 overflow-hidden relative">
        <Toast />

        <div class="fixed top-6 right-6 z-50 flex gap-2">
            <Button 
                :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" 
                rounded 
                raised 
                severity="secondary" 
                @click="toggleDarkMode"
                v-tooltip.bottom="isDark ? 'Mode Terang' : 'Mode Gelap'"
                class="!w-12 !h-12 shadow-lg transition-transform duration-300 bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700"
            />
            
            <Button 
                icon="pi pi-cog" 
                rounded 
                raised 
                severity="secondary" 
                aria-haspopup="true" 
                aria-controls="system_menu" 
                @click="toggleSystemMenu"
                v-tooltip.bottom="'Pengaturan Sistem'"
                class="!w-12 !h-12 shadow-lg hover:rotate-90 transition-transform duration-300 bg-surface-0 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700"
            />
            <Menu ref="systemMenu" id="system_menu" :model="systemMenuItems" :popup="true" class="!text-sm dark:bg-surface-800 dark:border-surface-700" />
        </div>

        <div 
            class="hidden lg:flex w-1/2 relative items-center justify-center p-12 overflow-hidden transition-colors duration-700"
            :style="{ backgroundColor: getThemeColor('var(--primary-600)') }"
        >
            <div class="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-surface-0/10 rounded-full blur-3xl"></div>
            <div class="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-black/10 rounded-full blur-3xl"></div>
            
            <div class="relative z-10 text-center text-white max-w-lg">
                <div class="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-surface-0/20 backdrop-blur-sm shadow-xl border border-white/30 overflow-hidden">
                    <img v-if="storeSettings.store_logo_url" :src="storeSettings.store_logo_url" class="w-full h-full object-cover" />
                    <i v-else class="pi pi-shop text-5xl text-white"></i>
                </div>
                <h2 class="text-4xl font-black mb-4 tracking-tight uppercase drop-shadow-md">
                    {{ latestStore?.name || displayAppName || 'Transaksi' }}
                </h2>
                <p class="text-lg text-white/90 font-light leading-relaxed drop-shadow">
                    {{ latestStore?.address || appVersion || 'Toko modern.' }}
                </p>
            </div>
            
            <div class="absolute bottom-8 text-white/60 text-xs">
                &copy; 2026 {{ latestStore?.name || displayAppName || 'Transaksi' }}. All rights reserved.
            </div>
        </div>

        <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
            <div class="w-full max-w-md bg-surface-0 dark:bg-surface-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-700 relative z-10 animate-fade-up transition-colors duration-500">
                
                <div class="text-center mb-10 lg:text-left">
                    <div 
                        class="lg:hidden w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto shadow-lg transition-colors"
                        :style="{ backgroundColor: getThemeColor('var(--primary-600)') }"
                    >
                        {{ latestStore ? latestStore.name.charAt(0) : 'R' }}
                    </div>
                    <h3 class="text-3xl font-bold mb-2 text-surface-900 dark:text-surface-0">Selamat Datang!</h3>
                    <p class="text-surface-500 dark:text-surface-400">Silakan masukkan detail akun {{ latestStore?.name }} untuk melanjutkan.</p>
                </div>

                <form @submit.prevent="handleLogin" class="flex flex-col gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-surface-700 dark:text-surface-300 ml-1">Username</label>
                        <div class="relative">
                            <i class="pi pi-user absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            <InputText 
                                v-model="form.username" 
                                placeholder="admin" 
                                class="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 dark:bg-surface-900 border-none focus:ring-2 transition-all text-surface-900 dark:text-surface-0" 
                                :style="{ '--tw-ring-color': getThemeColor('var(--primary-500)') }"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between items-center ml-1">
                            <label class="text-sm font-bold text-surface-700 dark:text-surface-300">Password</label>
                            <a href="#" class="text-xs font-semibold hover:underline" :style="{ color: getThemeColor('var(--primary-600)') }">Lupa Sandi?</a>
                        </div>
                        <div class="relative">
                            <i class="pi pi-lock absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            <Password 
                                v-model="form.password" 
                                :feedback="false" 
                                toggleMask 
                                placeholder="••••••" 
                                inputClass="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 dark:bg-surface-900 border-none focus:ring-2 !text-surface-900 dark:!text-surface-0 shadow-sm placeholder:text-surface-400" 
                                :style="{ '--tw-ring-color': getThemeColor('var(--primary-500)') }"
                                class="w-full"
                            />
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        label="MASUK DASHBOARD" 
                        icon="pi pi-arrow-right" 
                        iconPos="right"
                        class="w-full py-3.5 font-bold text-lg shadow-lg transition-all transform active:scale-95 rounded-xl mt-2 border-none text-white" 
                        :style="{ 
                            backgroundColor: getThemeColor('var(--primary-600)'),
                            boxShadow: `0 10px 15px -3px ${getThemeColor('var(--primary-500)')}4d` 
                        }"
                        :loading="loading" 
                    />
                </form>

                <div v-if="!storeExists" class="mt-8 text-center border-t border-surface-100 dark:border-surface-700 pt-8 relative z-20">
                    <p class="text-sm text-surface-500 dark:text-surface-400 flex flex-wrap items-center justify-center gap-1">
                        Belum punya akun atau toko? 
                        <button 
                            @click="router.push('/install')" 
                            class="font-bold hover:underline cursor-pointer bg-transparent border-none p-0 m-0 transition-all"
                            :style="{ color: getThemeColor('var(--primary-600)') }"
                        >
                            Buat Toko Sekarang
                        </button>
                    </p>
                </div>

                <div v-else class="mt-8 text-center border-t border-surface-100 dark:border-surface-700 pt-6 relative z-20">
                    <p class="text-xs text-surface-400 dark:text-surface-500">
                        Belum punya akun? <span class="font-medium text-surface-600 dark:text-surface-300">Hubungi Administrator</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-up {
    animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

:deep(.p-password) { display: block; }
:deep(.p-password-input) { width: 100%; }
</style>