<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
// Import color mode dari Nuxt
const colorMode = useColorMode();

definePageMeta({ layout: 'blank' });

const router = useRouter();
const toast = useToast();
const installService = useInstallService();

// --- STATE ---
const activeStep = ref(0);
const loading = ref(false);

const logoFile = ref(null);
const logoPreviewUrl = ref(null); 

const steps = ref([
    { label: 'Profil Toko', icon: 'pi pi-shopping-bag' },
    { label: 'Akun Admin', icon: 'pi pi-user' },
    { label: 'Selesai', icon: 'pi pi-check-circle' }
]);

const form = reactive({
    // Store
    name: '',
    storeAddress: '',
    storePhone: '',
    // User
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
});

// --- LOGIC ---

// Fungsi Toggle Theme
const toggleTheme = () => {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
};

const handleFileSelect = (event) => {
    const file = event.files ? event.files[0] : null;
    
    if (file && file.type.startsWith('image/')) {
        logoFile.value = file;
        
        if (logoPreviewUrl.value) {
            URL.revokeObjectURL(logoPreviewUrl.value);
        }
        logoPreviewUrl.value = URL.createObjectURL(file);
    } else {
        logoFile.value = null;
        logoPreviewUrl.value = null;
        toast.add({ severity: 'warn', summary: 'Format Salah', detail: 'Hanya file gambar (JPG/PNG) yang diizinkan.', life: 3000 });
    }
    if (event.target) event.target.value = '';
};

const handleRemoveLogo = () => {
    if (logoPreviewUrl.value) {
        URL.revokeObjectURL(logoPreviewUrl.value);
    }
    logoFile.value = null;
    logoPreviewUrl.value = null;
};

const nextStep = () => {
    if (activeStep.value === 0) {
        if (!form.name) {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Nama Toko wajib diisi', life: 3000 });
            return;
        }
        activeStep.value++;
    }
};

const prevStep = () => {
    if (activeStep.value > 0) activeStep.value--;
};

const handleInstall = async () => {
    if (!form.username || !form.password) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Username & Password wajib diisi', life: 3000 });
        return;
    }
    if (form.password !== form.confirmPassword) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Password tidak cocok', life: 3000 });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            name: form.name,
            address: form.storeAddress,
            phone: form.storePhone,
            username: form.username,
            password: form.password,
            email: form.email,
        };

        const response = await installService.installStore(payload, logoFile.value);

        if (process.client) {
            localStorage.setItem('accessToken', response.tokens.accessToken);
            localStorage.setItem('refreshToken', response.tokens.refreshToken);
            
            if (response.store?.uuid) {
                localStorage.setItem('selectedStoreId', response.store.uuid);
            }
        }

        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Sistem siap digunakan!', life: 3000 });
        activeStep.value++; 

    } catch (e) {
        console.error(e);
        const msg = e.data?.message || 'Gagal melakukan instalasi';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        loading.value = false;
    }
};

const goToLogin = () => {
    if (process.client) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('selectedStoreId');
    }
    router.push('/login');
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
    <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 p-4 relative transition-colors duration-300">
        <Toast />

        <div class="absolute top-4 right-4 md:top-8 md:right-8 z-50 flex items-center gap-3">
             <Button 
                :icon="colorMode.value === 'dark' ? 'pi pi-sun' : 'pi pi-moon'" 
                class="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20 backdrop-blur-sm transition-all" 
                rounded
                v-tooltip.bottom="colorMode.value === 'dark' ? 'Mode Terang' : 'Mode Gelap'"
                @click="toggleTheme" 
            />
            
             <Button 
                label="Kembali ke Login" 
                icon="pi pi-sign-in" 
                class="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20 backdrop-blur-sm transition-all" 
                size="small" 
                @click="goToLogin" 
            />
        </div>

        <div class="bg-surface-0 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row relative z-10 border border-surface-200/50">
            
            <div class="w-full md:w-1/3 bg-surface-50 p-8 flex flex-col justify-between border-r border-surface-200">
                <div>
                    <div class="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-6 shadow-lg">R</div>
                    <h1 class="text-2xl font-bold mb-2 text-surface-900">Setup Wizard</h1>
                    <p class="text-surface-500 text-sm leading-relaxed">
                        Selamat datang! Mari siapkan Toko dan Akun Admin Anda.
                    </p>
                </div>
                <div class="mt-8 hidden md:block">
                    <Steps :model="steps" :activeStep="activeStep" :readonly="true" />
                </div>
            </div>

            <div class="w-full md:w-2/3 p-8 md:p-12 relative flex flex-col justify-center bg-surface-0">
                
                <div v-if="activeStep === 0" class="animate-fade-in">
                    <h2 class="text-xl font-bold mb-1 text-primary-600">1. Profil Toko</h2>
                    <p class="text-sm text-surface-500 mb-6">Identitas toko untuk struk & laporan.</p>

                    <div class="flex flex-col gap-4">
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Logo Toko (Opsional)</label>
                            <div class="flex items-center gap-4 p-3 border border-surface-200 rounded-xl bg-surface-50">
                                
                                <div class="relative shrink-0">
                                    <img :src="logoPreviewUrl || 'https://placehold.co/70x70/FFFFFF/4c51bf?text=LOGO'" alt="Logo Preview" class="w-[70px] h-[70px] object-cover rounded-full border-4 border-surface-0 shadow-md" />
                                    <Button v-if="logoFile" icon="pi pi-times" severity="danger" rounded text size="small" class="absolute top-0 right-0 !w-6 !h-6" @click="handleRemoveLogo" />
                                </div>

                                <FileUpload 
                                    mode="basic" 
                                    name="logo" 
                                    accept="image/*" 
                                    :maxFileSize="1000000" 
                                    @select="handleFileSelect" 
                                    customUpload 
                                    chooseLabel="Pilih Gambar"
                                    :auto="false"
                                    class="!p-0 flex-1"
                                >
                                    <template #choosebutton="{ chooseCallback, label, icon }">
                                        <Button :label="logoFile ? 'Ganti Logo' : label" :icon="icon" @click="chooseCallback" size="small" severity="secondary" class="w-full" />
                                    </template>
                                </FileUpload>
                            </div>
                        </div>

                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Nama Toko <span class="text-red-500">*</span></label>
                            <InputText v-model="form.name" class="w-full" placeholder="Contoh: Toko Maju Jaya" autofocus />
                        </div>
                        
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Alamat</label>
                            <Textarea v-model="form.storeAddress" rows="2" class="w-full" placeholder="Alamat lengkap..." />
                        </div>
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">No. Telepon</label>
                            <InputText v-model="form.storePhone" class="w-full" placeholder="08..." />
                        </div>
                    </div>
                    <div class="mt-8 flex justify-end">
                        <Button label="Lanjut ke Akun" icon="pi pi-arrow-right" iconPos="right" @click="nextStep" />
                    </div>
                </div>

                <div v-if="activeStep === 1" class="animate-fade-in">
                    <h2 class="text-xl font-bold mb-1 text-primary-600">2. Akun Admin</h2>
                    <p class="text-sm text-surface-500 mb-6">Buat akun super admin.</p>

                    <div class="flex flex-col gap-4">
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Username <span class="text-red-500">*</span></label>
                            <InputText v-model="form.username" class="w-full" placeholder="admin" />
                        </div>
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Email (Opsional)</label>
                            <InputText v-model="form.email" class="w-full" type="email" placeholder="admin@example.com" />
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="field">
                                <label class="font-semibold text-sm mb-1 block text-surface-700">Password <span class="text-red-500">*</span></label>
                                <Password v-model="form.password" class="w-full" :feedback="true" toggleMask inputClass="w-full" />
                            </div>
                            <div class="field">
                                <label class="font-semibold text-sm mb-1 block text-surface-700">Konfirmasi <span class="text-red-500">*</span></label>
                                <Password v-model="form.confirmPassword" class="w-full" :feedback="false" toggleMask inputClass="w-full" />
                            </div>
                        </div>
                    </div>
                    <div class="mt-8 flex justify-between">
                         <Button label="Kembali" icon="pi pi-arrow-left" text @click="prevStep" severity="secondary" />
                        <Button label="Install & Selesai" icon="pi pi-check" :loading="loading" @click="handleInstall" severity="success" />
                    </div>
                </div>

                <div v-if="activeStep === 2" class="animate-fade-in flex flex-col items-center justify-center text-center h-full">
                    <div class="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-sm">
                        <i class="pi pi-check text-5xl font-bold"></i>
                    </div>
                    <h2 class="text-3xl font-bold mb-3 text-surface-900">Instalasi Berhasil!</h2>
                    <p class="text-surface-500 mb-8 max-w-md leading-relaxed">
                        Toko <strong>{{ form.name }}</strong> telah dibuat.<br>
                        Silakan login menggunakan akun <strong class="text-surface-900">{{ form.username }}</strong> yang telah dibuat.
                    </p>
                    <Button label="Masuk Halaman Login" icon="pi pi-sign-in" size="large" @click="goToLogin" class="px-8 py-3 shadow-lg shadow-primary-500/30" />
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateX(15px); } to { opacity: 1; transform: translateX(0); } }
:deep(.p-steps-item .p-menuitem-link) { background: transparent; }
</style>