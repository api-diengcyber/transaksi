<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useAuthStore } from '~/stores/auth.store';

const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

// --- STATE NAVIGASI ---
const activeTab = ref('general'); 

const menuItems = [
    { id: 'general', label: 'Profil Toko', icon: 'pi pi-building' },
    { id: 'transaction', label: 'Transaksi', icon: 'pi pi-calculator' },
    // ... menu lain
];

// --- DATA STORE ---
const currentStore = computed(() => authStore.activeStore);

// --- FORM STATE ---
const loading = ref(false);

// 1. Profil Toko
const storeForm = reactive({
    name: '',
    address: '',
    phone: ''
});

// 2. Settings Transaksi (Penjualan & Pembelian)
const saleSettings = reactive({
    taxEnabled: false,
    taxPercentage: 0,
    printReceiptAuto: false,
    printerWidth: '58mm',
    allowNegativeStock: false
});

const purchaseSettings = reactive({
    requireSupplier: false,
    autoApprove: true,
    defaultPaymentTerm: 0 // Hari
});

// Populate
const populateForms = () => {
    if (currentStore.value) {
        storeForm.name = currentStore.value.name || '';
        storeForm.address = currentStore.value.address || '';
        storeForm.phone = currentStore.value.phone || '';
        
        const s = currentStore.value.settings || {};
        
        // Mapping Sale Settings
        saleSettings.printerWidth = s.printer_width || '58mm';
        saleSettings.taxPercentage = Number(s.tax_percentage) || 0;
        saleSettings.taxEnabled = !!saleSettings.taxPercentage;
        saleSettings.printReceiptAuto = s.auto_print === 'true';
        saleSettings.allowNegativeStock = s.allow_negative_stock === 'true';

        // Mapping Purchase Settings (Contoh)
        purchaseSettings.requireSupplier = s.buy_require_supplier === 'true';
        purchaseSettings.autoApprove = s.buy_auto_approve !== 'false'; // Default true
    }
};

onMounted(async () => {
    if (!authStore.stores.length) {
        await authStore.fetchUserStores();
    }
    populateForms();
});

watch(currentStore, () => populateForms());

// --- ACTIONS ---
const saveSettings = async () => {
    loading.value = true;
    try {
        // Gabungkan semua setting ke payload key-value
        const payload = {
            name: storeForm.name,
            address: storeForm.address,
            phone: storeForm.phone,
            settings: [
                // Sale
                { key: 'printer_width', value: saleSettings.printerWidth },
                { key: 'tax_percentage', value: saleSettings.taxEnabled ? String(saleSettings.taxPercentage) : '0' },
                { key: 'auto_print', value: String(saleSettings.printReceiptAuto) },
                { key: 'allow_negative_stock', value: String(saleSettings.allowNegativeStock) },
                
                // Purchase
                { key: 'buy_require_supplier', value: String(purchaseSettings.requireSupplier) },
                { key: 'buy_auto_approve', value: String(purchaseSettings.autoApprove) }
            ]
        };

        // Simulasi API Call
        await new Promise(r => setTimeout(r, 800));
        // await storeService.updateStore(currentStore.value.uuid, payload);
        await authStore.fetchUserStores();

        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Pengaturan disimpan.', life: 3000 });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menyimpan', life: 3000 });
    } finally {
        loading.value = false;
    }
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
                        <h2 class="font-bold text-surface-700 dark:text-surface-200">Pengaturan Toko</h2>
                        <p class="text-xs text-surface-500">Konfigurasi sistem toko</p>
                    </div>
                    <ul class="p-2 flex flex-col gap-1">
                        <li v-for="item in menuItems" :key="item.id">
                            <button 
                                @click="activeTab = item.id"
                                class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 text-left"
                                :class="activeTab === item.id 
                                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500' 
                                    : 'text-surface-600 hover:bg-surface-50 dark:text-surface-300 hover:text-surface-900'"
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
                     <div class="mb-6 border-b border-surface-100 dark:border-surface-700 pb-4 flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-surface-800 dark:text-surface-0">Profil Toko</h2>
                            <p class="text-surface-500 text-sm">Informasi identitas toko.</p>
                        </div>
                        <Button label="Simpan" icon="pi pi-save" size="small" @click="saveSettings" :loading="loading" />
                    </div>
                    <div class="grid grid-cols-1 gap-6 max-w-2xl">
                        <div class="field">
                            <label class="text-sm font-semibold block mb-1">Nama Toko</label>
                            <InputText v-model="storeForm.name" class="w-full" />
                        </div>
                        <div class="field">
                            <label class="text-sm font-semibold block mb-1">Alamat</label>
                            <Textarea v-model="storeForm.address" rows="2" class="w-full" />
                        </div>
                         <div class="field">
                            <label class="text-sm font-semibold block mb-1">Telepon</label>
                            <InputText v-model="storeForm.phone" class="w-full" />
                        </div>
                    </div>
                </div>

                <div v-if="activeTab === 'transaction'" class="space-y-6">
                    
                    <div class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
                        <div class="p-4 border-b border-surface-100 dark:border-surface-700 bg-green-50 dark:bg-green-900/10 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <i class="pi pi-shopping-cart text-sm"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-green-800 dark:text-green-100 text-sm">Penjualan </h3>
                                    <p class="text-xs text-green-600 dark:text-green-300">Pengaturan kasir dan struk.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="border border-surface-100 rounded-lg p-3">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-semibold">Pajak (PPN)</span>
                                    <InputSwitch v-model="saleSettings.taxEnabled" />
                                </div>
                                <InputNumber v-if="saleSettings.taxEnabled" v-model="saleSettings.taxPercentage" suffix="%" :min="0" :max="100" inputClass="w-full text-center" placeholder="0%" />
                            </div>

                            <div class="border border-surface-100 rounded-lg p-3 flex justify-between items-center">
                                <div>
                                    <span class="text-sm font-semibold block">Stok Minus</span>
                                    <span class="text-xs text-surface-500">Boleh jual barang kosong?</span>
                                </div>
                                <InputSwitch v-model="saleSettings.allowNegativeStock" />
                            </div>

                            <div class="col-span-1 md:col-span-2">
                                <label class="text-sm font-semibold block mb-2">Konfigurasi Printer</label>
                                <div class="flex gap-4 items-center">
                                    <SelectButton v-model="saleSettings.printerWidth" :options="['58mm', '80mm']" class="text-xs" />
                                    <div class="flex items-center gap-2">
                                        <Checkbox v-model="saleSettings.printReceiptAuto" binary inputId="autoprint" />
                                        <label for="autoprint" class="text-sm cursor-pointer">Auto Print</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
                        <div class="p-4 border-b border-surface-100 dark:border-surface-700 bg-orange-50 dark:bg-orange-900/10 flex justify-between items-center">
                             <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                    <i class="pi pi-truck text-sm"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-orange-800 dark:text-orange-100 text-sm">Pembelian (Stok Masuk)</h3>
                                    <p class="text-xs text-orange-600 dark:text-orange-300">Aturan kulakan barang.</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-6 space-y-4">
                            <div class="flex items-center justify-between border-b border-surface-100 pb-3">
                                <div>
                                    <span class="text-sm font-semibold block">Wajib Isi Supplier</span>
                                    <span class="text-xs text-surface-500">Harus memilih supplier saat input stok?</span>
                                </div>
                                <InputSwitch v-model="purchaseSettings.requireSupplier" />
                            </div>

                            <div class="flex items-center justify-between">
                                <div>
                                    <span class="text-sm font-semibold block">Auto Approve</span>
                                    <span class="text-xs text-surface-500">Stok langsung bertambah tanpa perlu persetujuan supervisor?</span>
                                </div>
                                <InputSwitch v-model="purchaseSettings.autoApprove" />
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <Button label="Simpan Semua Pengaturan" icon="pi pi-save" size="large" @click="saveSettings" :loading="loading" />
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