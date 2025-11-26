<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

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

// [BARU] Handler File Upload
const handleFileSelect = (event) => {
    const file = event.files ? event.files[0] : null;
    
    if (file && file.type.startsWith('image/')) {
        logoFile.value = file;
        
        // Buat URL preview
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
    // Step 0: Validasi Toko
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
    // Validasi Step 1: User
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
        // Construct Payload GABUNGAN
        const payload = {
            // Data Toko
            name: form.name,
            address: form.storeAddress,
            phone: form.storePhone,
            
            // Data User
            username: form.username,
            password: form.password,
            email: form.email,
        };

        // Panggil SINGLE ENDPOINT (dengan file logo)
        const response = await installService.installStore(payload, logoFile.value);

        // Response: { tokens, store, user }
        // Simpan Token
        const tokenCookie = useCookie('accessToken', { maxAge: 60 * 60 * 24 * 7, path: '/' });
        const refreshTokenCookie = useCookie('refreshToken', { maxAge: 60 * 60 * 24 * 7, path: '/' });
        tokenCookie.value = response.tokens.accessToken;
        refreshTokenCookie.value = response.tokens.refreshToken;

        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Sistem siap digunakan!', life: 3000 });
        activeStep.value++; // Ke Step 3

    } catch (e) {
        console.error(e);
        const msg = e.data?.message || 'Gagal melakukan instalasi';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- FUNGSI BARU UNTUK SELESAI DAN KE HALAMAN LOGIN ---
const goToLogin = () => {
    // 1. Hapus semua token yang tersimpan saat instalasi
    const accessToken = useCookie('accessToken');
    const refreshToken = useCookie('refreshToken');
    accessToken.value = null;
    refreshToken.value = null;

    // 2. Arahkan ke halaman login
    router.push('/login');
};
</script>

<template>
    <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 p-4">
        <Toast />

        <div class="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
            
            <div class="w-full md:w-1/3 bg-surface-50 dark:bg-surface-800 p-8 flex flex-col justify-between border-r border-surface-200 dark:border-surface-700">
                <div>
                    <div class="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-6 shadow-lg">R</div>
                    <h1 class="text-2xl font-bold text-surface-800 dark:text-surface-100 mb-2">Setup Wizard</h1>
                    <p class="text-surface-500 text-sm leading-relaxed">
                        Selamat datang! Mari siapkan Toko dan Akun Admin Anda.
                    </p>
                </div>
                <div class="mt-8 hidden md:block">
                    <Steps :model="steps" :activeStep="activeStep" :readonly="true" />
                </div>
            </div>

            <div class="w-full md:w-2/3 p-8 md:p-12 relative flex flex-col justify-center bg-white dark:bg-surface-900">
                
                <div v-if="activeStep === 0" class="animate-fade-in">
                    <h2 class="text-xl font-bold mb-1 text-primary-600">1. Profil Toko</h2>
                    <p class="text-sm text-surface-500 mb-6">Identitas toko untuk struk & laporan.</p>

                    <div class="flex flex-col gap-4">
                        
                        <!-- [BARU] UPLOAD LOGO -->
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Logo Toko (Opsional)</label>
                            <div class="flex items-center gap-4 p-3 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-50 dark:bg-surface-800">
                                
                                <div class="relative shrink-0">
                                    <img :src="logoPreviewUrl || 'https://placehold.co/70x70/FFFFFF/4c51bf?text=LOGO'" alt="Logo Preview" class="w-[70px] h-[70px] object-cover rounded-full border-4 border-white dark:border-surface-900 shadow-md" />
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

                        <!-- Nama Toko -->
                        <div class="field">
                            <label class="font-semibold text-sm mb-1 block text-surface-700">Nama Toko <span class="text-red-500">*</span></label>
                            <InputText v-model="form.name" class="w-full" placeholder="Contoh: Toko Maju Jaya" autofocus />
                        </div>
                        
                        <!-- Alamat & Telepon -->
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
                    <h2 class="text-3xl font-bold text-surface-900 dark:text-surface-0 mb-3">Instalasi Berhasil!</h2>
                    <p class="text-surface-500 mb-8 max-w-md leading-relaxed">
                        Toko <strong>{{ form.name }}</strong> telah dibuat.<br>
                        Silakan login menggunakan akun <strong>{{ form.username }}</strong> yang telah dibuat.
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