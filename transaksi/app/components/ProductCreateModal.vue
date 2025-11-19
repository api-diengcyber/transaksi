<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import ShelfCreateModal from '~/components/ShelfCreateModal.vue'; 

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

const productService = useProductService();
const toast = useToast();

const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

// State Data Utama
const product = reactive({ name: '' });
const configUnits = ref([]); 
const configPrices = ref([]);
// Structure: [{ unitTempId, unitName, totalQty: 0, allocations: [{ shelfUuid, qty }] }]
const configStocks = ref([]); 

// State Modal Rak & Data Rak
const showShelfModal = ref(false);
const shelfOptions = ref([]); 

const unitOptions = ['PCS', 'BOX', 'KG', 'LITER', 'PACK', 'CARTON', 'DUS', 'LUSIN'];

// --- MOCK SERVICE RAK ---
const fetchShelves = async () => {
    // Simulasi data rak
    shelfOptions.value = [
        { uuid: 'rak-01', name: 'Rak A-01 (Depan)' },
        { uuid: 'rak-02', name: 'Rak B-05 (Gudang)' },
        { uuid: 'rak-03', name: 'Display Toko' }
    ];
};

const onShelfCreated = () => {
    fetchShelves(); 
};

// --- HELPER INIT FORM ---
const initForm = () => {
    product.name = '';
    const tempId = Date.now();
    configUnits.value = [{ tempId, unitName: 'PCS', multiplier: 1, barcode: '', isDefault: true }];
    configPrices.value = [{ tempId: tempId + 1, unitTempId: tempId, name: 'Umum', price: 0, isDefault: true }];
    syncStocks();
};

// Sync Stok List saat Unit Berubah
const syncStocks = () => {
    const newStocks = configUnits.value.map(u => {
        const existing = configStocks.value.find(s => s.unitTempId === u.tempId);
        
        return {
            unitTempId: u.tempId,
            unitName: u.unitName,
            // Pisahkan Total Stok Fisik dengan Alokasi Rak
            totalQty: existing ? existing.totalQty : 0, 
            allocations: existing ? existing.allocations : [] 
        };
    });
    configStocks.value = newStocks;
};

// --- WATCHERS ---
watch(() => props.visible, async (val) => {
    if (val) {
        fetchShelves();
        if (!isEditMode.value) {
            initForm();
        }
    }
});

watch(configUnits, () => syncStocks(), { deep: true });

// --- ACTION HANDLERS ---
const addUnitRow = () => {
    const newId = Date.now();
    configUnits.value.push({ tempId: newId, unitName: 'PCS', multiplier: 1, barcode: '', isDefault: configUnits.value.length === 0 });
    configPrices.value.push({ tempId: newId + 1, unitTempId: newId, name: 'Umum', price: 0, isDefault: true });
};
const removeUnitRow = (index) => {
    if (configUnits.value.length === 1) return;
    const removed = configUnits.value[index];
    configUnits.value.splice(index, 1);
    configPrices.value = configPrices.value.filter(p => p.unitTempId !== removed.tempId);
};
const setUnitDefault = (index) => { configUnits.value.forEach((u, i) => u.isDefault = (i === index)); };

const addPriceRow = () => {
    const defaultUnitId = configUnits.value[0]?.tempId;
    configPrices.value.push({ tempId: Date.now(), unitTempId: defaultUnitId, name: '', price: 0, isDefault: false });
};
const removePriceRow = (index) => { configPrices.value.splice(index, 1); };
const setPriceDefault = (index) => { configPrices.value.forEach((p, i) => p.isDefault = (i === index)); };

// --- STOCK ALLOCATION HANDLERS ---
const addStockAllocation = (stockIndex) => {
    configStocks.value[stockIndex].allocations.push({ shelfUuid: null, qty: 0 });
};

const removeStockAllocation = (stockIndex, allocIndex) => {
    configStocks.value[stockIndex].allocations.splice(allocIndex, 1);
};

// --- SAVE ---
const saveProduct = async () => {
    submitted.value = true;
    if (!product.name) return;

    loading.value = true;
    try {
        const payload = {
            name: product.name,
            units: configUnits.value.map(u => ({
                tempId: u.tempId,
                name: u.unitName,
                multiplier: u.multiplier,
                barcode: u.barcode,
                isDefault: u.isDefault
            })),
            prices: configPrices.value.map(p => ({
                unitTempId: p.unitTempId,
                name: p.name || 'Umum',
                price: p.price,
                isDefault: p.isDefault
            })),
            // Payload Stok: Kirim Total Qty DAN Alokasi Rak secara terpisah/bersarang
            stocks: configStocks.value.map(s => ({
                unitTempId: s.unitTempId,
                qty: s.totalQty, // Total Stok (Inventory)
                allocations: s.allocations // Detail penempatan (Warehouse)
                    .filter(a => a.qty > 0 && a.shelfUuid)
                    .map(a => ({
                        shelfUuid: a.shelfUuid,
                        qty: a.qty
                    }))
            }))
        };

        if (isEditMode.value) {
            toast.add({ severity: 'info', summary: 'Info', detail: 'Fitur update belum tersedia.', life: 3000 });
        } else {
            const newProd = await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil dibuat', life: 3000 });
            emit('product-created', newProd);
        }
        closeDialog();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const closeDialog = () => emit('update:visible', false);
</script>

<template>
    <Dialog :visible="visible" @update:visible="val => emit('update:visible', val)" 
            :header="isEditMode ? 'Edit Produk' : 'Produk Baru'" 
            :modal="true" :style="{ width: '900px' }" maximizable 
            class="p-fluid" :pt="{ content: { class: '!py-2' } }">
        
        <div class="bg-surface-50 dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700 mb-6">
            <div class="field mb-0">
                <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Nama Produk <span class="text-red-500">*</span></label>
                <InputText v-model="product.name" placeholder="Contoh: Kopi Kapal Api" class="w-full !h-9 text-sm" :class="{'p-invalid': submitted && !product.name}" />
                <small class="text-red-500 text-[10px] mt-1" v-if="submitted && !product.name">Wajib diisi.</small>
            </div>
        </div>

        <div class="section-box mb-6">
            <div class="flex justify-between items-center mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-800/50 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                    Konfigurasi Satuan & Barcode
                </span>
                <Button label="Tambah Satuan" icon="pi pi-plus" size="small" text severity="primary" @click="addUnitRow" class="!py-1 !text-xs" />
            </div>
            <div class="table-container">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-200 text-[10px] uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center border-b dark:border-surface-700">Def</th>
                            <th class="p-2 w-32 border-b dark:border-surface-700">Satuan</th>
                            <th class="p-2 w-20 border-b dark:border-surface-700">Multiplier</th>
                            <th class="p-2 border-b dark:border-surface-700">Barcode / SKU</th>
                            <th class="p-2 w-8 text-center border-b dark:border-surface-700"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
                        <tr v-for="(u, idx) in configUnits" :key="u.tempId" class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="u.isDefault" :value="true" name="uDef" @change="setUnitDefault(idx)" class="scale-75" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="u.unitName" :options="unitOptions" class="w-full !h-8 text-xs compact-input" editable placeholder="Pilih" :pt="{ input: { class: '!py-1 !px-2' } }" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="u.multiplier" :min="1" class="w-full !h-8" inputClass="!text-xs !text-center !p-1" :disabled="u.isDefault" />
                            </td>
                            <td class="p-2 align-middle">
                                <div class="p-inputgroup !h-8">
                                    <span class="p-inputgroup-addon !px-2 !bg-surface-50 border-r-0 !min-w-[2rem]"><i class="pi pi-barcode text-surface-400 text-xs"></i></span>
                                    <InputText v-model="u.barcode" class="!text-xs !p-1" placeholder="Scan..." />
                                </div>
                            </td>
                            <td class="p-2 text-center align-middle">
                                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeUnitRow(idx)" class="!w-6 !h-6 !p-0" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section-box mb-6">
            <div class="flex justify-between items-center mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-800/50 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">2</div>
                    Harga Jual
                </span>
                <Button label="Tambah Harga" icon="pi pi-plus" size="small" text severity="success" @click="addPriceRow" class="!py-1 !text-xs" />
            </div>
            <div class="table-container">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-200 text-[10px] uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center border-b dark:border-surface-700">Def</th>
                            <th class="p-2 w-40 border-b dark:border-surface-700">Nama Harga</th>
                            <th class="p-2 w-32 border-b dark:border-surface-700">Satuan</th>
                            <th class="p-2 border-b dark:border-surface-700">Nominal (Rp)</th>
                            <th class="p-2 w-8 text-center border-b dark:border-surface-700"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
                        <tr v-for="(p, idx) in configPrices" :key="p.tempId" class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="p.isDefault" :value="true" name="pDef" @change="setPriceDefault(idx)" class="scale-75" /></td>
                            <td class="p-2 align-middle"><InputText v-model="p.name" class="w-full !h-8 !text-xs !p-1" placeholder="Cth: Umum" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="p.unitTempId" :options="configUnits" optionLabel="unitName" optionValue="tempId" class="w-full !h-8 text-xs compact-input" :pt="{ input: { class: '!py-1 !px-2' } }" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="p.price" mode="currency" currency="IDR" locale="id-ID" class="w-full !h-8" inputClass="!text-xs !text-right !p-1" />
                            </td>
                            <td class="p-2 text-center align-middle">
                                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removePriceRow(idx)" class="!w-6 !h-6 !p-0" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section-box mb-6">
            <div class="mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-800/50 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">3</div>
                    Stok Awal (Total)
                </span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                <div v-for="s in configStocks" :key="s.unitTempId" class="bg-surface-50 dark:bg-surface-800 p-2 rounded border border-surface-200 dark:border-surface-700">
                    <label class="text-[10px] font-bold text-surface-500 uppercase block mb-1">Total {{ s.unitName }}</label>
                    <InputNumber v-model="s.totalQty" :min="0" class="w-full !h-9" inputClass="!text-sm !text-center !font-bold text-surface-700" placeholder="0" />
                </div>
            </div>
        </div>

        <div class="section-box">
            <div class="mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-800/50 p-2 rounded-t-lg flex justify-between items-center">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">4</div>
                    Penempatan Rak / Lokasi (Opsional)
                </span>
                <Button label="Rak Baru" icon="pi pi-plus-circle" size="small" text severity="help" @click="showShelfModal = true" class="!py-1 !text-xs" />
            </div>
            
            <div class="p-3 space-y-4">
                <div v-for="(s, sIdx) in configStocks" :key="s.unitTempId" class="bg-surface-50 dark:bg-surface-800/40 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-sm text-surface-700 dark:text-surface-200 flex items-center gap-2">
                            <i class="pi pi-map-marker text-surface-400"></i>
                            Lokasi untuk: <span class="text-primary-600">{{ s.unitName }}</span>
                        </span>
                        <Button label="Tambah Lokasi" icon="pi pi-plus" size="small" outlined severity="secondary" class="!p-1 !text-[10px] !h-6" @click="addStockAllocation(sIdx)" />
                    </div>

                    <div v-if="s.allocations.length === 0" class="text-center py-2 text-xs text-surface-400 italic border border-dashed border-surface-200 rounded bg-white dark:bg-surface-900">
                        Belum ada penempatan rak. (Stok masuk ke gudang default)
                    </div>

                    <div v-else class="bg-white dark:bg-surface-900 rounded border border-surface-100 dark:border-surface-700 overflow-hidden">
                        <table class="w-full text-xs">
                            <thead class="bg-surface-100 dark:bg-surface-800 text-[10px] text-surface-500 uppercase">
                                <tr>
                                    <th class="p-2 text-left font-bold">Pilih Rak</th>
                                    <th class="p-2 w-24 text-center font-bold">Jumlah</th>
                                    <th class="p-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                                <tr v-for="(alloc, aIdx) in s.allocations" :key="aIdx">
                                    <td class="p-1.5">
                                        <Dropdown v-model="alloc.shelfUuid" :options="shelfOptions" optionLabel="name" optionValue="uuid" 
                                            placeholder="Pilih Rak..." class="w-full !h-8 text-xs compact-input" 
                                            :pt="{ input: { class: '!py-1 !px-2' }, panel: { class: '!text-xs' } }">
                                            <template #empty>
                                                <div class="p-2 text-center">
                                                    Data kosong. <span class="text-primary cursor-pointer font-bold" @click="showShelfModal = true">Buat Rak</span>
                                                </div>
                                            </template>
                                        </Dropdown>
                                    </td>
                                    <td class="p-1.5">
                                        <InputNumber v-model="alloc.qty" :min="0" :max="s.totalQty" class="w-full !h-8" inputClass="!text-xs !text-center !p-1 font-bold" placeholder="0" />
                                    </td>
                                    <td class="p-1.5 text-center">
                                        <Button icon="pi pi-times" text rounded severity="danger" class="!w-6 !h-6 !p-0" @click="removeStockAllocation(sIdx, aIdx)" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-700 mt-2">
                <Button label="Batal" icon="pi pi-times" text @click="closeDialog" severity="secondary" size="small" />
                <Button :label="isEditMode ? 'Simpan' : 'Buat Produk'" icon="pi pi-check" @click="saveProduct" :loading="loading" size="small" />
            </div>
        </template>
    </Dialog>

    <ShelfCreateModal 
        v-model:visible="showShelfModal" 
        @saved="onShelfCreated" 
    />
</template>

<style scoped>
.section-title {
    @apply text-sm font-bold text-surface-700 dark:text-surface-200 uppercase tracking-wide;
}
.section-box {
    @apply bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg shadow-sm overflow-hidden;
}
.table-container {
    @apply border-t border-surface-100 dark:border-surface-700;
}
/* Paksa styling input PrimeVue agar compact */
:deep(.compact-input .p-dropdown-label) {
    padding: 4px 8px !important;
    font-size: 0.75rem !important; 
}
:deep(.p-inputnumber-input) {
    padding: 4px 8px !important;
}
</style>