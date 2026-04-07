<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'blank' });

const authService = useAuthService();
const storeService = useStoreService();
const router = useRouter();
const toast = useToast();

const loading = ref(false);
const form = reactive({ username: '', password: '' });
const storeSettings = ref({});
const latestStore = ref(null);
const storeExists = ref(true);

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
                // Kita juga set warna hover/600 secara manual jika diperlukan
                document.documentElement.style.setProperty('--primary-600', color);
            }
        } else {
            storeExists.value = false;
        }
    } catch (error) {
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
    <div class="min-h-screen flex flex-col lg:flex-row bg-surface-0 overflow-hidden">
        <Toast />

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
                <h2 class="text-4xl font-black mb-4 tracking-tight uppercase">
                    {{ latestStore?.name || 'RetailApp Pro' }}
                </h2>
                <p class="text-lg text-white/90 font-light leading-relaxed">
                    {{ latestStore?.address || 'Kelola toko Anda dengan lebih cerdas, pantau stok real-time, dan tingkatkan penjualan dengan sistem kasir modern.' }}
                </p>
            </div>
            
            <div class="absolute bottom-8 text-white/60 text-xs">
                &copy; 2026 {{ latestStore?.name || 'RetailApp Inc' }}. All rights reserved.
            </div>
        </div>

        <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
            <div class="w-full max-w-md bg-surface-0 p-8 sm:p-10 rounded-3xl shadow-xl border border-surface-100 relative z-10 animate-fade-up">
                
                <div class="text-center mb-10 lg:text-left">
                    <div 
                        class="lg:hidden w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto shadow-lg transition-colors"
                        :style="{ backgroundColor: getThemeColor('var(--primary-600)') }"
                    >
                        {{ latestStore ? latestStore.name.charAt(0) : 'R' }}
                    </div>
                    <h3 class="text-3xl font-bold mb-2">Selamat Datang!</h3>
                    <p class="text-surface-500">Silakan masukkan detail akun {{ latestStore?.name }} untuk melanjutkan.</p>
                </div>

                <form @submit.prevent="handleLogin" class="flex flex-col gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-surface-700 ml-1">Username</label>
                        <div class="relative">
                            <i class="pi pi-user absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            <InputText 
                                v-model="form.username" 
                                placeholder="admin" 
                                class="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 border-none focus:ring-2 transition-all" 
                                :style="{ '--tw-ring-color': getThemeColor('var(--primary-500)') }"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between items-center ml-1">
                            <label class="text-sm font-bold text-surface-700">Password</label>
                            <a href="#" class="text-xs font-semibold hover:underline" :style="{ color: getThemeColor('var(--primary-600)') }">Lupa Sandi?</a>
                        </div>
                        <div class="relative">
                            <i class="pi pi-lock absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            <Password 
                                v-model="form.password" 
                                :feedback="false" 
                                toggleMask 
                                placeholder="••••••" 
                                inputClass="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 border-none focus:ring-2 !text-surface-900 shadow-sm placeholder:text-surface-400" 
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
                        class="w-full py-3.5 font-bold text-lg shadow-lg transition-all transform active:scale-95 rounded-xl mt-2 border-none" 
                        :style="{ 
                            backgroundColor: getThemeColor('var(--primary-600)'),
                            boxShadow: `0 10px 15px -3px ${getThemeColor('var(--primary-500)')}4d` 
                        }"
                        :loading="loading" 
                    />
                </form>

                <div v-if="!storeExists" class="mt-8 text-center border-t border-surface-100 pt-8">
                    <p class="text-sm text-surface-500">
                        Belum punya akun atau toko? 
                        <NuxtLink 
                            to="/install" 
                            class="font-bold hover:underline cursor-pointer ml-1"
                            :style="{ color: getThemeColor('var(--primary-600)') }"
                        >
                            Buat Toko Sekarang
                        </NuxtLink>
                    </p>
                </div>

                <div v-else class="mt-8 text-center">
                    <p class="text-xs text-surface-400">
                        Belum punya akun? <span class="font-medium">Hubungi Administrator</span>
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