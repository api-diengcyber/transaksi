<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useAuthStore } from '~/stores/auth.store';
import { useStoreService } from '~/composables/useStoreService'; // [BARU]

const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const storeService = useStoreService(); // [BARU]

// --- STATE UI ---
const activeTab = ref('general');
const loading = ref(false);
const initialLoading = ref(true);
const logoLoading = ref(false); // [BARU] State untuk upload logo

const menuItems = [
    { id: 'general', label: 'Identitas Toko', icon: 'pi pi-building', desc: 'Nama, alamat, dan kontak' },
    { id: 'display', label: 'Tampilan & Warna', icon: 'pi pi-palette', desc: 'Warna utama aplikasi' },
    { id: 'sales', label: 'Transaksi Penjualan', icon: 'pi pi-shopping-cart', desc: 'Pajak, struk, dan stok' },
    { id: 'purchase', label: 'Pembelian (Stok)', icon: 'pi pi-truck', desc: 'Supplier dan persetujuan' },
    { id: 'device', label: 'Perangkat & Printer', icon: 'pi pi-print', desc: 'Konfigurasi hardware' },
];

const settings = reactive({
    // 1. General
    store_name: '',
    store_phone: '',
    store_address: '',
    store_footer_msg: '',
    store_logo_url: null, // [BARU] URL logo (tersimpan di DB settings)
    theme_primary_color: '#2563eb',
    
    // 2. Sales
    sale_tax_enabled: false,        
    sale_tax_percentage: 0,         
    sale_tax_method: 'exclusive',   
    sale_allow_negative_stock: false,
    sale_require_customer: false,
    
    // 3. Purchase
    buy_require_supplier: true,
    buy_auto_approve: true,
    buy_default_due_days: 30,

    // 4. Device
    dev_printer_width: '58mm',
    dev_auto_print_receipt: true,
    dev_show_logo_receipt: false
});

// [BARU] Computed untuk menampilkan URL Logo
const currentLogoUrl = computed(() => {
    // Ambil URL logo dari state lokal (yang sudah dimuat dari API)
    const urlPath = settings.store_logo_url;
    const fallback = 'https://placehold.co/150x150/e0f2f1/047857?text=Logo+Store';
    
    if (!urlPath) return fallback;

    // Asumsi: Logo diakses melalui Base URL API
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase.replace('/api', ''); // Sesuaikan base URL Anda
    
    // Jika URL sudah full, gunakan langsung. Jika tidak, gabungkan dengan base URL.
    return urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
});


// --- LOGIC MAPPER ---

const mapApiToState = (apiSettingsObj) => {
    if (!apiSettingsObj || typeof apiSettingsObj !== 'object') return;

    // Handle jika backend mengembalikan Array [{key, value}]
    if (Array.isArray(apiSettingsObj)) {
        apiSettingsObj.forEach(item => {
            updateSettingValue(item.key, item.value);
        });
    } else {
        // Handle jika backend mengembalikan Object {key: value}
        for (const [key, value] of Object.entries(apiSettingsObj)) {
            updateSettingValue(key, value);
        }
    }
};

const updateSettingValue = (key, value) => {
    // [FIX] Khusus untuk logo, simpan langsung
    if (key === 'store_logo_url') {
        settings.store_logo_url = value;
        return;
    }
    
    if (settings.hasOwnProperty(key)) {
        const currentType = typeof settings[key];
        if (currentType === 'boolean') {
            settings[key] = String(value) === 'true' || String(value) === '1';
        } else if (currentType === 'number') {
            settings[key] = Number(value) || 0;
        } else {
            settings[key] = value;
        }
    }
}

const mapStateToPayload = () => {
    const settingsArray = [];
    const profileKeys = ['store_name', 'store_phone', 'store_address']; 
    
    // Semua properti settings yang bukan profile utama akan dikirim, termasuk store_logo_url
    for (const [key, value] of Object.entries(settings)) {
        if (profileKeys.includes(key)) continue;

        let formattedValue = value;
        if (typeof value === 'boolean') formattedValue = value ? 'true' : 'false';
        if (typeof value === 'number') formattedValue = String(value);
        if (value === null || value === undefined) formattedValue = ''; // Kirim string kosong jika null/undefined
        
        settingsArray.push({ key, value: formattedValue });
    }
    return settingsArray;
};

// --- FETCHING ---

const fetchSettings = async () => {
    initialLoading.value = true;
    try {
        await authStore.fetchUserStores();
        const storeData = authStore.activeStore;

        if (storeData) {
            // 1. Map Profil
            settings.store_name = storeData.name || '';
            settings.store_phone = storeData.phone || '';
            settings.store_address = storeData.address || '';
            
            // 2. Map Settings
            if (storeData.settings) {
                // Reset store_logo_url sebelum mapping, untuk mencegah duplikasi
                settings.store_logo_url = null; 
                mapApiToState(storeData.settings);
            }
        }
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat pengaturan toko' });
    } finally {
        initialLoading.value = false;
    }
};

// --- ACTIONS ---

const saveSettings = async () => {
    loading.value = true;
    try {
        // [FIX] Tambahkan store_footer_msg ke payload settings
        
        const payload = {
            name: settings.store_name,
            phone: settings.store_phone,
            address: settings.store_address,
            
            settings: mapStateToPayload() 
        };

        await authStore.saveStoreSettings(payload);
        
        await authStore.fetchUserStores(); 
        
        toast.add({ severity: 'success', summary: 'Tersimpan', detail: 'Pengaturan berhasil diperbarui.', life: 3000 });

    } catch (e) {
        console.error(e);
        const msg = e.response?._data?.message || e.message || 'Terjadi kesalahan saat menyimpan.';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg });
    } finally {
        loading.value = false;
    }
};

// [BARU] Handler ketika file dipilih/di-drop
const onLogoUpload = async (event) => {
    const file = event.files ? event.files[0] : null;

    if (!file) return;

    logoLoading.value = true;
    try {
        const response = await storeService.uploadStoreLogo(file);
        
        // Cek response, jika ada logoUrl yang dikirim dari API, gunakan itu
        if (response.logoUrl) {
            settings.store_logo_url = response.logoUrl;
        }
        
        // Muat ulang data toko untuk sinkronisasi state penuh (termasuk topbar)
        await authStore.fetchUserStores();
        
        toast.add({ 
            severity: 'success', 
            summary: 'Upload Sukses', 
            detail: `Logo berhasil diunggah dan disimpan!`, 
            life: 3000 
        });

    } catch (e) {
        console.error(e);
        toast.add({ 
            severity: 'error', 
            summary: 'Gagal Upload', 
            detail: e.message || 'Gagal mengunggah file. Pastikan formatnya benar.', 
            life: 5000 
        });
    } finally {
        logoLoading.value = false;
        // Penting: Reset komponen FileUpload agar tidak menyimpan file lama di memori UI
        event.target.value = ''; 
    }
};

const onRemoveLogo = () => {
     confirm.require({
        message: 'Anda yakin ingin menghapus logo toko saat ini? Logo akan diganti dengan placeholder.',
        header: 'Hapus Logo',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => {
            // Menghapus URL dari state lokal
            settings.store_logo_url = null;
            // Langsung panggil saveSettings untuk menyimpan perubahan (menghapus URL dari DB)
            saveSettings();
        }
    });
};


const handleReset = () => {
    confirm.require({
        message: 'Kembalikan ke pengaturan terakhir disimpan?',
        header: 'Konfirmasi Reset',
        icon: 'pi pi-refresh',
        acceptClass: 'p-button-danger',
        accept: () => {
            fetchSettings();
        }
    });
};

onMounted(() => {
    fetchSettings();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 md:p-6 animate-fade-in">
        <Toast />
        <ConfirmDialog />

        <div class="max-w-6xl mx-auto">
            <!-- Header Page -->
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-2xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Pengaturan Toko</h1>
                    <p class="text-surface-500 text-sm mt-1">Kelola profil, preferensi transaksi, dan konfigurasi sistem.</p>
                </div>
                <div class="flex gap-3">
                    <Button label="Reset" icon="pi pi-refresh" severity="secondary" text @click="handleReset" :disabled="loading" />
                    <Button label="Simpan Perubahan" icon="pi pi-save" @click="saveSettings" :loading="loading" raised />
                </div>
            </div>

            <div class="flex flex-col lg:flex-row gap-8">
                
                <!-- SIDEBAR MENU -->
                <aside class="w-full lg:w-64 shrink-0 space-y-2">
                    <div class="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm sticky top-24">
                        <div class="p-2">
                            <button 
                                v-for="item in menuItems" 
                                :key="item.id"
                                @click="activeTab = item.id"
                                class="w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all duration-200 group relative overflow-hidden"
                                :class="activeTab === item.id 
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-bold ring-1 ring-primary-200 dark:ring-primary-800' 
                                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900'"
                            >
                                <div class="mt-0.5" :class="activeTab === item.id ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'">
                                    <i :class="item.icon"></i>
                                </div>
                                <div>
                                    <div class="text-sm">{{ item.label }}</div>
                                    <div class="text-[10px] opacity-70 font-normal mt-0.5 leading-tight">{{ item.desc }}</div>
                                </div>
                                <div v-if="activeTab === item.id" class="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full"></div>
                            </button>
                        </div>
                    </div>
                </aside>

                <!-- CONTENT AREA -->
                <main class="flex-1">
                    <div v-if="initialLoading" class="flex justify-center py-20">
                        <ProgressSpinner style="width: 50px; height: 50px" />
                    </div>

                    <div v-else class="space-y-6">
                        
                        <!-- TAB: GENERAL -->
                        <div v-if="activeTab === 'general'" class="animate-fade-in space-y-6">
                            
                             <!-- Logo Upload Section -->
                            <div class="card-section">
                                <h3 class="section-title">Logo Toko</h3>
                                <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                                    <div class="shrink-0 relative">
                                        <img :src="currentLogoUrl" alt="Store Logo" class="w-24 h-24 object-cover rounded-full shadow-md border-4 border-surface-0 dark:border-surface-900" />
                                        <div v-if="logoLoading" class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                            <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="6" animationDuration=".5s" class="text-white" />
                                        </div>
                                    </div>
                                    
                                    <div class="flex flex-col items-center sm:items-start">
                                        <p class="text-sm text-surface-600 dark:text-surface-400 mb-3">Unggah logo baru (Max 1MB, format: JPG/PNG). URL akan tersimpan di database.</p>

                                        <div class="flex gap-2">
                                            <FileUpload 
                                                mode="basic" 
                                                name="file" 
                                                accept="image/*" 
                                                :maxFileSize="1000000" 
                                                @uploader="onLogoUpload" 
                                                customUpload 
                                                chooseLabel="Unggah Logo"
                                                :auto="true"
                                                :disabled="logoLoading || loading"
                                                class="!p-0"
                                            >
                                                <template #choosebutton="{ chooseCallback, label, icon }">
                                                    <Button :label="label" :icon="icon" @click="chooseCallback" size="small" :severity="logoLoading ? 'secondary' : 'primary'" :disabled="logoLoading || loading" />
                                                </template>
                                            </FileUpload>

                                            <Button v-if="settings.store_logo_url" label="Hapus Logo" icon="pi pi-trash" severity="danger" size="small" @click="onRemoveLogo" :disabled="loading" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="card-section">
                                <h3 class="section-title">Identitas Utama</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div class="field">
                                        <label>Nama Toko</label>
                                        <InputText v-model="settings.store_name" class="w-full" placeholder="Contoh: Toko Makmur Jaya" />
                                    </div>
                                    <div class="field">
                                        <label>No. Telepon</label>
                                        <InputText v-model="settings.store_phone" class="w-full" placeholder="0812..." />
                                    </div>
                                    <div class="field md:col-span-2">
                                        <label>Alamat Lengkap</label>
                                        <Textarea v-model="settings.store_address" rows="3" class="w-full" />
                                    </div>
                                     <div class="field md:col-span-2">
                                        <label>Pesan Kaki (Footer Note Struk)</label>
                                        <InputText v-model="settings.store_footer_msg" class="w-full" placeholder="Contoh: Terimakasih telah berbelanja!" />
                                        <small class="text-surface-500">Teks ini akan muncul di bagian paling bawah struk belanja.</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: DISPLAY -->
                        <div v-else-if="activeTab === 'display'" class="animate-fade-in space-y-6">
                            <div class="card-section">
                                <h3 class="section-title">Warna Utama Aplikasi</h3>
                                <div class="field">
                                    <label>Pilih Warna Utama (Hex Code)</label>
                                    <div class="flex gap-4 items-center">
                                        <ColorPicker v-model="settings.theme_primary_color" format="hex" class="!w-10 !h-10" />
                                        <InputText v-model="settings.theme_primary_color" placeholder="#2563eb" class="w-40 !py-2.5 !text-sm font-mono" />
                                        <span class="text-sm text-surface-500">Warna ini akan mempengaruhi tombol dan elemen highlight.</span>
                                    </div>
                                    <small class="text-surface-500 mt-2 block">
                                        *Catatan: Perubahan warna mungkin memerlukan *hard refresh* (Ctrl/Cmd + Shift + R) di browser untuk melihat efek penuh di seluruh UI.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: SALES -->
                        <div v-if="activeTab === 'sales'" class="animate-fade-in space-y-6">
                            <div class="card-section">
                                <div class="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 class="section-title !mb-0">Pajak Penjualan (PPN)</h3>
                                        <p class="text-xs text-surface-500 mt-1">Atur pajak pertambahan nilai otomatis.</p>
                                    </div>
                                    <InputSwitch v-model="settings.sale_tax_enabled" />
                                </div>

                                <div v-if="settings.sale_tax_enabled" class="bg-surface-50 dark:bg-surface-800 p-4 rounded-xl border border-surface-200 dark:border-surface-700 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <div class="field">
                                        <label>Persentase Pajak (%)</label>
                                        <InputNumber v-model="settings.sale_tax_percentage" suffix="%" :min="0" :max="100" showButtons class="w-full" />
                                    </div>
                                    <div class="field">
                                        <label>Metode Perhitungan</label>
                                        <SelectButton v-model="settings.sale_tax_method" 
                                            :options="[{label: 'Exclude (Harga + PPN)', value: 'exclusive'}, {label: 'Include (Harga tmsk PPN)', value: 'inclusive'}]" 
                                            optionLabel="label" optionValue="value" 
                                            class="w-full text-xs"
                                            :pt="{ button: { class: '!text-xs !py-2' } }"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class="card-section">
                                <h3 class="section-title">Kebijakan Stok & Pelanggan</h3>
                                <div class="space-y-4">
                                    <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors">
                                        <div>
                                            <div class="font-bold text-sm text-surface-800 dark:text-surface-100">Izinkan Stok Minus</div>
                                            <div class="text-xs text-surface-500">Kasir tetap bisa input barang meski stok 0.</div>
                                        </div>
                                        <InputSwitch v-model="settings.sale_allow_negative_stock" />
                                    </div>
                                    <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors">
                                        <div>
                                            <div class="font-bold text-sm text-surface-800 dark:text-surface-100">Wajib Pilih Pelanggan</div>
                                            <div class="text-xs text-surface-500">Transaksi tidak bisa diproses tanpa data pelanggan.</div>
                                        </div>
                                        <InputSwitch v-model="settings.sale_require_customer" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: PURCHASE -->
                        <div v-if="activeTab === 'purchase'" class="animate-fade-in space-y-6">
                            <div class="card-section">
                                <h3 class="section-title">Konfigurasi Pembelian</h3>
                                <div class="grid grid-cols-1 gap-4">
                                    <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg">
                                        <div>
                                            <div class="font-bold text-sm">Wajib Isi Supplier</div>
                                            <div class="text-xs text-surface-500">Mencegah input stok masuk tanpa asal-usul.</div>
                                        </div>
                                        <InputSwitch v-model="settings.buy_require_supplier" />
                                    </div>
                                    
                                    <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg">
                                        <div>
                                            <div class="font-bold text-sm">Otomatis Approve</div>
                                            <div class="text-xs text-surface-500">Stok langsung bertambah tanpa perlu persetujuan Supervisor.</div>
                                        </div>
                                        <InputSwitch v-model="settings.buy_auto_approve" />
                                    </div>

                                    <div class="field mt-2">
                                        <label>Jatuh Tempo Default (Hari)</label>
                                        <InputNumber v-model="settings.buy_default_due_days" suffix=" Hari" class="w-full md:w-1/2" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB: DEVICE -->
                        <div v-if="activeTab === 'device'" class="animate-fade-in space-y-6">
                            <div class="card-section">
                                <h3 class="section-title">Pengaturan Printer Struk</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div class="field">
                                        <label>Ukuran Kertas</label>
                                        <div class="flex gap-4 mt-1">
                                            <div class="flex align-items-center">
                                                <RadioButton v-model="settings.dev_printer_width" inputId="p58" name="paper" value="58mm" />
                                                <label for="p58" class="ml-2 text-sm">58mm (Kecil)</label>
                                            </div>
                                            <div class="flex align-items-center">
                                                <RadioButton v-model="settings.dev_printer_width" inputId="p80" name="paper" value="80mm" />
                                                <label for="p80" class="ml-2 text-sm">80mm (Standar)</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="field">
                                        <label>Opsi Cetak</label>
                                        <div class="flex flex-col gap-2 mt-1">
                                            <div class="flex align-items-center">
                                                <Checkbox v-model="settings.dev_auto_print_receipt" binary inputId="autoprint" />
                                                <label for="autoprint" class="ml-2 text-sm">Otomatis Print setelah bayar</label>
                                            </div>
                                            <div class="flex align-items-center">
                                                <Checkbox v-model="settings.dev_show_logo_receipt" binary inputId="showlogo" />
                                                <label for="showlogo" class="ml-2 text-sm">Tampilkan Logo Toko</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section {
    @apply bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6;
}

.section-title {
    @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-4 pb-2 border-b border-surface-100 dark:border-surface-700;
}

.field label {
    @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>