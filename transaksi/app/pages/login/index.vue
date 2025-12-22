<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'blank' });

const authService = useAuthService();
const router = useRouter();
const toast = useToast();

const loading = ref(false);
const form = reactive({ username: '', password: '' });

const handleLogin = async () => {
    if (!form.username || !form.password) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Mohon lengkapi form login.', life: 3000 });
        return;
    }

    loading.value = true;
    try {
        const response = await authService.login({ username: form.username, password: form.password });
        const tokenCookie = useCookie('accessToken', { maxAge: 60 * 60 * 24 * 7, path: '/' });
        tokenCookie.value = response.accessToken;

        toast.add({ severity: 'success', summary: 'Login Berhasil', detail: 'Mengalihkan ke dashboard...', life: 2000 });
        setTimeout(() => router.push('/'), 800);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal Masuk', detail: 'Username atau sandi salah.', life: 3000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen flex flex-col lg:flex-row bg-surface-0 dark:bg-surface-400 overflow-hidden">
        <Toast />

        <div class="hidden lg:flex w-1/2 bg-primary-600 dark:bg-primary-900 relative items-center justify-center p-12 overflow-hidden">
            <div class="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-surface-0/10 rounded-full blur-3xl"></div>
            <div class="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-primary-400/20 rounded-full blur-3xl"></div>
            
            <div class="relative z-10 text-center text-white max-w-lg">
                <div class="mb-8 inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-surface-0/20 backdrop-blur-sm shadow-xl border border-white/30">
                    <i class="pi pi-chart-bar text-5xl text-white"></i>
                </div>
                <h2 class="text-4xl font-black mb-4 tracking-tight">RetailApp Pro</h2>
                <p class="text-lg text-primary-100 font-light leading-relaxed">
                    Kelola toko Anda dengan lebih cerdas, pantau stok real-time, dan tingkatkan penjualan dengan sistem kasir modern.
                </p>
            </div>
            
            <div class="absolute bottom-8 text-primary-200 text-xs">
                &copy; 2025 RetailApp Inc. All rights reserved.
            </div>
        </div>

        <div class="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
            <div class="w-full max-w-md bg-surface-0 dark:bg-surface-400 p-8 sm:p-10 rounded-3xl shadow-xl border border-surface-100 dark:border-surface-800 relative z-10 animate-fade-up">
                
                <div class="text-center mb-10 lg:text-left">
                    <div class="lg:hidden w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4 mx-auto shadow-lg">R</div>
                    <h3 class="text-3xl font-bold text-surface-900 dark:text-surface-0 mb-2">Selamat Datang!</h3>
                    <p class="text-surface-500 dark:text-surface-400">Masukkan detail akun untuk melanjutkan.</p>
                </div>

                <form @submit.prevent="handleLogin" class="flex flex-col gap-6">
                    
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-bold text-surface-700 dark:text-surface-300 ml-1">Username</label>
                        <div class="relative">
                            <i class="pi pi-user absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            
                            <InputText 
                                v-model="form.username" 
                                placeholder="admin" 
                                class="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 dark:bg-surface-400 border-none focus:ring-2 focus:ring-primary-500 transition-all text-surface-800 dark:text-surface-100" 
                                :class="{'p-invalid': !form.username && loading}"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex justify-between items-center ml-1">
                            <label class="text-sm font-bold text-surface-700 dark:text-surface-300">Password</label>
                            <a href="#" class="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline">Lupa Sandi?</a>
                        </div>
                        <div class="relative">
                            <i class="pi pi-lock absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 text-lg z-10"></i>
                            
                            <Password 
                                v-model="form.password" 
                                :feedback="false" 
                                toggleMask 
                                placeholder="••••••" 
                                inputClass="w-full !pl-12 !py-3 !rounded-xl bg-surface-50 dark:bg-surface-400 border-none focus:ring-2 focus:ring-primary-500 !text-surface-900 dark:!text-surface-0 shadow-sm placeholder:text-surface-400" 
                                class="w-full"
                            />
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        label="MASUK DASHBOARD" 
                        icon="pi pi-arrow-right" 
                        iconPos="right"
                        class="w-full py-3.5 font-bold text-lg shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all transform active:scale-95 rounded-xl mt-2" 
                        :loading="loading" 
                    />
                </form>

                <div class="mt-8 text-center">
                    <p class="text-xs text-surface-400">
                        Belum punya akun? <span class="text-surface-600 dark:text-surface-300 font-medium">Hubungi Administrator</span>
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

/* Override Password Component Style */
:deep(.p-password) { display: block; }
:deep(.p-password-input) { width: 100%; }
</style>