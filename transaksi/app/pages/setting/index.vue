<script setup>
import { ref, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// --- STATE NAVIGASI SIDEBAR ---
const activeTab = ref('general'); // general, pos, users, data

const menuItems = [
    { id: 'general', label: 'Profil Toko', icon: 'pi pi-building' },
    { id: 'pos', label: 'Preferensi Transaksi', icon: 'pi pi-calculator' },
    { id: 'users', label: 'Manajemen Akses', icon: 'pi pi-users' },
    { id: 'data', label: 'Data & Keamanan', icon: 'pi pi-database' },
];

// --- STATE FORM DATA ---
const loading = ref(false);

// 1. Profil Toko
const storeSettings = reactive({
    name: 'Toko Maju Jaya',
    address: 'Jl. Sudirman No. 45, Jakarta Selatan',
    phone: '0812-3456-7890',
    email: 'admin@majujaya.com',
    footerReceipt: 'Terima kasih telah berbelanja!\nBarang yang dibeli tidak dapat dikembalikan.',
    logo: null
});

// 2. Preferensi POS
const posSettings = reactive({
    taxEnabled: true,
    taxPercentage: 11,
    allowNegativeStock: false, 
    printReceiptAuto: true,
    printerWidth: '58mm', 
    currencySymbol: 'Rp',
});

// 3. Manajemen User (Dummy Data)
const users = ref([
    { id: 1, name: 'Budi Santoso', role: 'Admin', status: 'Active', email: 'budi@store.com' },
    { id: 2, name: 'Siti Aminah', role: 'Kasir', status: 'Active', email: 'siti@store.com' },
    { id: 3, name: 'Joko Anwar', role: 'Kasir', status: 'Inactive', email: 'joko@store.com' },
]);

// --- ACTIONS ---

const saveSettings = () => {
    loading.value = true;
    setTimeout(() => {
        loading.value = false;
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Pengaturan berhasil disimpan.', life: 3000 });
    }, 1000);
};

const handleResetDatabase = () => {
    confirm.require({
        message: 'PERHATIAN: Tindakan ini akan menghapus SELURUH data transaksi dan produk. Apakah Anda yakin?',
        header: 'Zona Bahaya',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => {
            toast.add({ severity: 'error', summary: 'Reset', detail: 'Database telah direset (Simulasi).', life: 3000 });
        }
    });
};

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="py-6 animate-fade-in">
        <Toast />
        <ConfirmDialog />

        <div class="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4">
            
            <aside class="w-full lg:w-1/4 shrink-0">
                <div class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden sticky top-24">
                    <div class="p-4 bg-surface-50 dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700">
                        <h2 class="font-bold text-surface-700 dark:text-surface-200">Pengaturan</h2>
                        <p class="text-xs text-surface-500">Konfigurasi sistem toko Anda</p>
                    </div>
                    <ul class="p-2 flex flex-col gap-1">
                        <li v-for="item in menuItems" :key="item.id">
                            <button 
                                @click="activeTab = item.id"
                                class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-left"
                                :class="activeTab === item.id 
                                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500' 
                                    : 'text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800 hover:text-surface-900'"
                            >
                                <i :class="[item.icon, activeTab === item.id ? 'text-primary-600' : 'text-surface-400']"></i>
                                {{ item.label }}
                            </button>
                        </li>
                    </ul>
                </div>
            </aside>

            <main class="w-full lg:w-3/4">
                
                <div v-if="activeTab === 'general'" class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 md:p-8">
                    <div class="mb-6 border-b border-surface-100 dark:border-surface-700 pb-4">
                        <h2 class="text-xl font-bold text-surface-800 dark:text-surface-0">Profil Toko</h2>
                        <p class="text-surface-500 text-sm">Informasi yang akan tampil pada struk belanja.</p>
                    </div>

                    <div class="grid grid-cols-1 gap-6 max-w-2xl">
                        <div class="flex flex-col gap-2">
                            <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Nama Toko</label>
                            <InputText v-model="storeSettings.name" class="w-full" />
                        </div>

                        <div class="flex flex-col gap-2">
                            <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Alamat Lengkap</label>
                            <Textarea v-model="storeSettings.address" rows="3" class="w-full" />
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Nomor Telepon</label>
                                <InputText v-model="storeSettings.phone" class="w-full" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Email Admin</label>
                                <InputText v-model="storeSettings.email" class="w-full" />
                            </div>
                        </div>
                        
                        <div class="flex flex-col gap-2">
                            <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Footer Struk (Catatan Bawah)</label>
                            <Textarea v-model="storeSettings.footerReceipt" rows="2" class="w-full font-mono text-sm" />
                        </div>

                        <div class="pt-4">
                            <Button label="Simpan Perubahan" icon="pi pi-save" @click="saveSettings" :loading="loading" />
                        </div>
                    </div>
                </div>

                <div v-if="activeTab === 'pos'" class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 md:p-8">
                    <div class="mb-6 border-b border-surface-100 dark:border-surface-700 pb-4">
                        <h2 class="text-xl font-bold text-surface-800 dark:text-surface-0">Preferensi Transaksi</h2>
                        <p class="text-surface-500 text-sm">Aturan main kasir dan pencetakan struk.</p>
                    </div>

                    <div class="space-y-8 max-w-3xl">
                        <div class="flex items-start justify-between p-4 border border-surface-100 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                            <div>
                                <h4 class="font-bold text-surface-800 dark:text-surface-100 text-sm">Pajak (PPN)</h4>
                                <p class="text-xs text-surface-500 mt-1">Tambahkan pajak otomatis pada total transaksi.</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <InputNumber v-if="posSettings.taxEnabled" v-model="posSettings.taxPercentage" suffix="%" :min="0" :max="100" inputClass="w-16 text-center !py-1 !text-sm" />
                                <InputSwitch v-model="posSettings.taxEnabled" />
                            </div>
                        </div>

                        <div class="flex items-start justify-between p-4 border border-surface-100 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                            <div>
                                <h4 class="font-bold text-surface-800 dark:text-surface-100 text-sm">Izinkan Stok Minus</h4>
                                <p class="text-xs text-surface-500 mt-1">Kasir tetap bisa melakukan transaksi meski stok produk 0.</p>
                            </div>
                            <InputSwitch v-model="posSettings.allowNegativeStock" />
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div class="flex flex-col gap-2">
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Ukuran Kertas Printer</label>
                                <SelectButton v-model="posSettings.printerWidth" :options="['58mm', '80mm']" aria-labelledby="basic" class="w-full" />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-semibold text-surface-700 dark:text-surface-200">Otomatis Cetak</label>
                                <div class="flex items-center gap-2 h-full">
                                    <Checkbox v-model="posSettings.printReceiptAuto" binary inputId="autoprint" />
                                    <label for="autoprint" class="text-sm text-surface-600 dark:text-surface-300 cursor-pointer">Langsung cetak setelah bayar</label>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4">
                            <Button label="Simpan Preferensi" icon="pi pi-save" severity="primary" @click="saveSettings" :loading="loading" />
                        </div>
                    </div>
                </div>

                <div v-if="activeTab === 'users'" class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 md:p-8">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-surface-100 dark:border-surface-700 pb-4">
                        <div>
                            <h2 class="text-xl font-bold text-surface-800 dark:text-surface-0">Manajemen Akses</h2>
                            <p class="text-surface-500 text-sm">Daftar pengguna yang dapat mengakses sistem.</p>
                        </div>
                        <Button label="Tambah User" icon="pi pi-user-plus" size="small" />
                    </div>

                    <DataTable :value="users" stripedRows tableStyle="min-width: 40rem">
                        <Column field="name" header="Nama Pengguna">
                            <template #body="slotProps">
                                <div class="flex items-center gap-3">
                                    <Avatar :label="slotProps.data.name.charAt(0)" shape="circle" class="bg-primary-100 text-primary-700 font-bold" />
                                    <div>
                                        <div class="font-bold text-sm text-surface-800 dark:text-surface-100">{{ slotProps.data.name }}</div>
                                        <div class="text-xs text-surface-500">{{ slotProps.data.email }}</div>
                                    </div>
                                </div>
                            </template>
                        </Column>
                        <Column field="role" header="Role">
                            <template #body="slotProps">
                                <Tag :value="slotProps.data.role" :severity="slotProps.data.role === 'Admin' ? 'info' : 'warning'" />
                            </template>
                        </Column>
                        <Column field="status" header="Status">
                            <template #body="slotProps">
                                <span :class="slotProps.data.status === 'Active' ? 'text-green-600' : 'text-red-500'" class="text-xs font-bold uppercase">
                                    {{ slotProps.data.status }}
                                </span>
                            </template>
                        </Column>
                        <Column header="Aksi" style="width: 10%">
                            <template #body>
                                <Button icon="pi pi-pencil" text rounded severity="secondary" />
                            </template>
                        </Column>
                    </DataTable>
                </div>

                <div v-if="activeTab === 'data'" class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 md:p-8">
                    <div class="mb-6 border-b border-surface-100 dark:border-surface-700 pb-4">
                        <h2 class="text-xl font-bold text-surface-800 dark:text-surface-0">Data & Keamanan</h2>
                        <p class="text-surface-500 text-sm">Backup, restore, dan reset sistem.</p>
                    </div>

                    <div class="space-y-6">
                        <div class="p-4 border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-50 dark:bg-surface-800/50 flex justify-between items-center">
                            <div>
                                <h4 class="font-bold text-surface-800 dark:text-surface-100 text-sm">Export Data Transaksi</h4>
                                <p class="text-xs text-surface-500 mt-1">Unduh semua data penjualan dalam format Excel/CSV.</p>
                            </div>
                            <Button label="Download Backup" icon="pi pi-download" severity="secondary" outlined />
                        </div>

                        <div class="border-t border-surface-100 dark:border-surface-700 my-4"></div>

                        <div class="border border-red-200 bg-red-50 dark:bg-red-900/10 rounded-xl p-4">
                            <h4 class="font-bold text-red-700 dark:text-red-400 mb-2 text-sm">Zona Bahaya</h4>
                            <div class="flex justify-between items-center">
                                <p class="text-xs text-red-600 dark:text-red-300 max-w-md">
                                    Mereset database akan menghapus semua produk, transaksi, dan user secara permanen. Tindakan ini tidak dapat dibatalkan.
                                </p>
                                <Button label="Reset Database" icon="pi pi-exclamation-triangle" severity="danger" @click="handleResetDatabase" />
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>