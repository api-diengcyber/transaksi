<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
// Pastikan path import ini benar sesuai struktur project Anda
import ShelveCreateModal from '~/components/shelve/ShelveCreateModal.vue'; 

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

// [BARU] Inject Service Category & Product
const productService = useProductService();
const shelveService = useShelveService();
const categoryService = useCategoryService(); 
const toast = useToast();

const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

// State Data Utama
const product = reactive({ 
    name: '', 
    categoryUuids: [] 
});

const configUnits = ref([]); 
const configPrices = ref([]);

// State Options
const showShelfModal = ref(false);
const shelfOptions = ref([]); 
const categoryOptions = ref([]); 
const unitOptions = ['PCS', 'BOX', 'KG', 'LITER', 'PACK', 'CARTON', 'DUS', 'LUSIN'];

// --- FETCH DATA UTILS ---

const fetchShelves = async () => {
    try {
        const data = await shelveService.getAllShelves(); 
        shelfOptions.value = data || [];
    } catch (e) { console.error(e); }
};

// [BARU] Fetch Data Kategori
const fetchCategories = async () => {
    try {
        const data = await categoryService.getAllCategorys(); 
        // Map ke format label/value untuk PrimeVue
        categoryOptions.value = (data || []).map(c => ({
            label: c.name,
            value: c.uuid
        }));
    } catch (e) { console.error(e); }
};

const onShelveCreated = () => {
    fetchShelves(); 
};

// --- LOAD DATA FOR EDIT ---
const loadProductData = async (uuid) => {
    loading.value = true;
    try {
        // Data yang dikembalikan oleh API (ProductService.findOne) sudah menyertakan units[].currentStock
        const data = await productService.getProduct(uuid); 
        
        if (!data) throw new Error("Data produk tidak ditemukan");

        // 1. Isi Nama
        product.name = data.name;

        // [FIXED] 2. Isi Kategori (Menggunakan productCategory)
        if (data.productCategory && Array.isArray(data.productCategory)) {
            product.categoryUuids = data.productCategory.map(pc => pc.category?.uuid).filter(Boolean);
        } else {
            product.categoryUuids = [];
        }

        // 3. Mapping Units (ADD STOCK FIELDS)
        configUnits.value = data.units.map(u => {
             // [FIX KRITIS] Mengambil stok aktual dari properti currentStock yang diinjeksi oleh backend ProductService
            const currentQty = Number(u.currentStock || 0); 

            return {
                uuid: u.uuid, 
                tempId: u.uuid, 
                unitName: u.unitName,
                multiplier: Number(u.unitMultiplier),
                barcode: u.barcode,
                isDefault: data.defaultUnitUuid === u.uuid,
                allocations: [],
                // [FIX] Menggunakan stok aktual untuk inisialisasi oldQty dan newQty
                oldQty: currentQty,
                newQty: currentQty, // Awalnya, newQty sama dengan oldQty
            };
        });

        // 4. Mapping Prices
        const pricesData = data.prices || data.price || [];
        configPrices.value = pricesData.map(p => ({
            uuid: p.uuid,
            tempId: Date.now() + Math.random(),
            unitTempId: p.unitUuid,
            name: p.name,
            price: Number(p.price),
            minWholesaleQty: Number(p.minWholesaleQty) || 0, 
            isDefault: data.defaultPriceUuid === p.uuid
        }));

        // 5. Mapping Shelves (Alokasi Rak)
        configUnits.value.forEach(unitItem => {
            const backendShelves = (data.shelve || []).filter(s => s.unitUuid === unitItem.tempId);
            if (backendShelves.length > 0) {
                unitItem.allocations = backendShelves.map(bs => ({
                    shelfUuid: bs.shelveUuid,
                    qty: Number(bs.qty)
                }));
            }
        });

    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data produk', life: 3000 });
        closeDialog();
    } finally {
        loading.value = false;
    }
};

// --- HELPER INIT FORM (RESET) ---
const initForm = () => {
    product.name = '';
    product.categoryUuids = []; 
    const tempId = Date.now();
    
    // [MODIFIKASI] Tambahkan newQty & oldQty untuk Stok Awal (Create Mode)
    configUnits.value = [{ 
        tempId, unitName: 'PCS', multiplier: 1, barcode: '', isDefault: true, allocations: [],
        oldQty: 0,
        newQty: 0, 
    }]; 
    configPrices.value = [{ tempId: tempId + 1, unitTempId: tempId, name: 'Umum', price: 0, minWholesaleQty: 0, isDefault: true }]; 
};


// --- WATCHERS ---
watch(() => props.visible, async (val) => {
    if (val) {
        fetchShelves();
        fetchCategories(); 
        
        submitted.value = false;
        if (isEditMode.value && props.productUuid) {
            await loadProductData(props.productUuid);
        } else {
            initForm();
        }
    }
});

// --- ACTION HANDLERS ---
const addUnitRow = () => {
    const newId = Date.now();
    // [MODIFIKASI] Tambahkan fields stok ke unit baru
    configUnits.value.push({ 
        tempId: newId, unitName: 'PCS', multiplier: 1, barcode: '', isDefault: configUnits.value.length === 0, allocations: [],
        oldQty: 0,
        newQty: 0,
    });
    configPrices.value.push({ tempId: newId + 1, unitTempId: newId, name: 'Umum', price: 0, minWholesaleQty: 0, isDefault: true });
};

const removeUnitRow = (index) => {
    if (configUnits.value.length === 1) {
           toast.add({ severity: 'warn', summary: 'Warning', detail: 'Minimal harus ada 1 satuan.', life: 2000 });
           return;
    }
    const removed = configUnits.value[index];
    configUnits.value.splice(index, 1);
    configPrices.value = configPrices.value.filter(p => p.unitTempId !== removed.tempId);
};
const setUnitDefault = (index) => { configUnits.value.forEach((u, i) => u.isDefault = (i === index)); };

const addPriceRow = () => {
    const defaultUnitId = configUnits.value[0]?.tempId;
    configPrices.value.push({ tempId: Date.now(), unitTempId: defaultUnitId, name: '', price: 0, minWholesaleQty: 0, isDefault: false });
};
const removePriceRow = (index) => { configPrices.value.splice(index, 1); };
const setPriceDefault = (index) => { configPrices.value.forEach((p, i) => p.isDefault = (i === index)); };

const addStockAllocation = (unitIndex) => { 
    configUnits.value[unitIndex].allocations.push({ shelfUuid: null, qty: 0 });
};
const removeStockAllocation = (unitIndex, allocIndex) => {
    configUnits.value[unitIndex].allocations.splice(allocIndex, 1);
};


// --- SAVE / UPDATE ---
const saveProduct = async () => {
    submitted.value = true;
    if (!product.name) return;

    loading.value = true;
    try {
        // 1. Kumpulkan data penyesuaian stok (newQty vs oldQty)
        const stockAdjustments = [];
        configUnits.value.forEach(u => {
            // Hanya rekam jika ada perubahan (saat edit) atau ada stok awal (saat create)
            // Cek: jika newQty BEDA dengan oldQty
            if (Number(u.newQty) !== Number(u.oldQty)) { 
                stockAdjustments.push({
                    unitUuid: u.uuid || u.tempId, 
                    oldQty: Number(u.oldQty) || 0,
                    newQty: Number(u.newQty) || 0
                });
            }
        });


        // 2. Susun Payload
        const payload = {
            name: product.name,
            categoryUuids: product.categoryUuids, 
            units: configUnits.value.map(u => ({
                uuid: u.uuid, 
                tempId: u.tempId, 
                name: u.unitName,
                multiplier: u.multiplier,
                barcode: u.barcode,
                isDefault: u.isDefault
            })),
            prices: configPrices.value.map(p => ({
                uuid: p.uuid, 
                unitTempId: p.unitTempId, 
                name: p.name || 'Umum',
                price: p.price,
                minWholesaleQty: p.minWholesaleQty || 0,
                isDefault: p.isDefault
            })),
            
            // [BARU] Kirim data penyesuaian stok untuk diproses di Journal
            stockAdjustments: stockAdjustments,

            // Payload Stocks hanya untuk Shelves
            stocks: configUnits.value.map(u => ({
                unitTempId: u.tempId,
                qty: 0, // DUMMY: Diabaikan oleh backend ProductService
                allocations: u.allocations
                    .filter(a => a.qty > 0 && a.shelfUuid)
                    .map(a => ({
                        shelfUuid: a.shelfUuid,
                        qty: a.qty
                    }))
            }))
        };

        if (isEditMode.value) {
            await productService.updateProduct(props.productUuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil diperbarui', life: 3000 });
            emit('product-updated');
        } else {
            const newProd = await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil dibuat', life: 3000 });
            emit('product-created', newProd);
        }
        closeDialog();
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan server', life: 3000 });
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
            class="p-fluid" :pt="{ content: { class: '!py-2 dark:bg-surface-400' } }">
        
        <div class="p-4 rounded-lg border border-surface-200 dark:border-surface-700 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="field mb-0">
                    <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Nama Produk <span class="text-red-500">*</span></label>
                    <InputText v-model="product.name" placeholder="Contoh: Kopi Kapal Api" class="w-full !h-9 text-sm dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" :class="{'p-invalid': submitted && !product.name}" />
                    <small class="text-red-500 text-[10px] mt-1" v-if="submitted && !product.name">Wajib diisi.</small>
                </div>

                <div class="field mb-0">
                    <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Kategori (Multi)</label>
                    <MultiSelect 
                        v-model="product.categoryUuids" 
                        :options="categoryOptions" 
                        optionLabel="label" 
                        optionValue="value" 
                        placeholder="Pilih Kategori" 
                        display="chip" 
                        filter
                        class="w-full !min-h-[2.25rem] text-xs compact-multiselect dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700"
                        :pt="{ label: { class: '!py-1.5 !px-2' } }"
                    />
                </div>
            </div>
        </div>

        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-400">
            <div class="flex justify-between items-center mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-400 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                    Konfigurasi Satuan & Barcode
                </span>
                <Button label="Tambah Satuan" icon="pi pi-plus" size="small" text severity="primary" @click="addUnitRow" class="!py-1 !text-xs" />
            </div>
            <div class="table-container">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-400 text-surface-600 dark:text-surface-200 text-[10px] uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center border-b dark:border-surface-700">Def</th>
                            <th class="p-2 w-32 border-b dark:border-surface-700">Satuan</th>
                            <th class="p-2 w-20 border-b dark:border-surface-700">Multiplier</th>
                            <th class="p-2 border-b dark:border-surface-700">Barcode / SKU</th>
                            <th class="p-2 w-8 text-center border-b dark:border-surface-700"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                        <tr v-for="(u, idx) in configUnits" :key="u.tempId" class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="u.isDefault" :value="true" name="uDef" @change="setUnitDefault(idx)" class="scale-75" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="u.unitName" :options="unitOptions" class="w-full !h-8 text-xs compact-input dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" editable placeholder="Pilih" :pt="{ input: { class: '!py-1 !px-2' } }" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="u.multiplier" :min="1" class="w-full !h-8 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" inputClass="!text-xs !text-center !p-1" :disabled="u.isDefault" />
                            </td>
                            <td class="p-2 align-middle">
                                <div class="p-inputgroup !h-8">
                                    <span class="p-inputgroup-addon !px-2 !bg-surface-50 dark:!bg-surface-700 border-r-0 !min-w-[2rem] dark:border-surface-700"><i class="pi pi-barcode text-surface-400 dark:text-surface-500 text-xs"></i></span>
                                    <InputText v-model="u.barcode" class="!text-xs !p-1 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" placeholder="Scan..." />
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

        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-400">
            <div class="flex justify-between items-center mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-400 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">2</div>
                    Harga Jual
                </span>
                <Button label="Tambah Harga" icon="pi pi-plus" size="small" text severity="success" @click="addPriceRow" class="!py-1 !text-xs" />
            </div>
            <div class="table-container">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-400 text-surface-600 dark:text-surface-200 text-[10px] uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center border-b dark:border-surface-700">Def</th>
                            <th class="p-2 w-40 border-b dark:border-surface-700">Nama Harga</th>
                            <th class="p-2 w-32 border-b dark:border-surface-700">Satuan</th>
                            <th class="p-2 w-28 text-center border-b dark:border-surface-700">Min Grosir</th>
                            <th class="p-2 border-b dark:border-surface-700">Nominal (Rp)</th>
                            <th class="p-2 w-8 text-center border-b dark:border-surface-700"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                        <tr v-for="(p, idx) in configPrices" :key="p.tempId" class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="p.isDefault" :value="true" name="pDef" @change="setPriceDefault(idx)" class="scale-75" /></td>
                            <td class="p-2 align-middle"><InputText v-model="p.name" class="w-full !h-8 !text-xs !p-1 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" placeholder="Cth: Umum" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="p.unitTempId" :options="configUnits" optionLabel="unitName" optionValue="tempId" class="w-full !h-8 text-xs compact-input dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" :pt="{ input: { class: '!py-1 !px-2' } }" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="p.minWholesaleQty" :min="0" class="w-full !h-8 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" inputClass="!text-xs !text-center !p-1" placeholder="0" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="p.price" mode="currency" currency="IDR" locale="id-ID" class="w-full !h-8 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" inputClass="!text-xs !text-right !p-1" />
                            </td>
                            <td class="p-2 text-center align-middle">
                                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removePriceRow(idx)" class="!w-6 !h-6 !p-0" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-400">
            <div class="mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-400 p-2 rounded-t-lg">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">3</div>
                    Stok Awal / Penyesuaian
                </span>
                <span v-if="isEditMode" class="text-[10px] text-orange-500 ml-auto italic bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded">Isi hanya jika ada penambahan atau pengurangan stok</span>
                <span v-else class="text-[10px] text-blue-500 ml-auto italic bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">Stok awal saat produk dibuat</span>
            </div>
            
            <div v-if="isEditMode && configUnits.every(u => u.oldQty === 0)" class="p-3 text-center text-red-500 text-xs italic">
                ⚠️ Stok Lama saat ini terdeteksi 0. Pastikan Anda sudah mengimplementasikan API kalkulasi stok dari Journal untuk mengisi nilai ini saat mode Edit!
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                <div v-for="u in configUnits" :key="u.tempId" class="bg-surface-50 dark:bg-surface-400 p-2 rounded border border-surface-200 dark:border-surface-700">
                    <label class="text-[10px] font-bold text-surface-500 uppercase block mb-1">
                         {{ isEditMode ? 'Stok Baru' : 'Stok Awal' }} ({{ u.unitName }})
                    </label>
                     <div v-if="isEditMode" class="text-[10px] text-surface-400 mb-1">Stok Lama: {{ u.oldQty }}</div>
                    <InputNumber v-model="u.newQty" :min="0" class="w-full !h-9" inputClass="!text-sm !text-center !font-bold text-surface-700 dark:text-surface-100 dark:bg-surface-400" placeholder="0" />
                </div>
            </div>
        </div>

        <div class="section-box bg-surface-0 dark:bg-surface-400">
            <div class="mb-2 border-b border-surface-200 dark:border-surface-700 pb-2 bg-surface-50/50 dark:bg-surface-400 p-2 rounded-t-lg flex justify-between items-center">
                <span class="section-title flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">4</div>
                    Penempatan Rak / Lokasi (Opsional)
                </span>
                <Button label="Rak Baru" icon="pi pi-plus-circle" size="small" text severity="help" @click="showShelfModal = true" class="!py-1 !text-xs" />
            </div>
            
            <div class="p-3 space-y-4">
                <div v-for="(u, uIdx) in configUnits" :key="u.tempId" class="bg-surface-50 dark:bg-surface-400/40 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-sm text-surface-700 dark:text-surface-200 flex items-center gap-2">
                            <i class="pi pi-map-marker text-surface-400"></i>
                            Lokasi untuk: <span class="text-primary-600">{{ u.unitName }}</span>
                        </span>
                        <Button label="Tambah Lokasi" icon="pi pi-plus" size="small" outlined severity="secondary" class="!p-1 !text-[10px] !h-6" @click="addStockAllocation(uIdx)" />
                    </div>

                    <div v-if="u.allocations.length === 0" class="text-center py-2 text-xs text-surface-400 italic border border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-0 dark:bg-surface-400">
                        Belum ada penempatan rak.
                    </div>

                    <div v-else class="bg-surface-0 dark:bg-surface-400 rounded border border-surface-100 dark:border-surface-700 overflow-hidden">
                        <table class="w-full text-xs">
                            <thead class="bg-surface-100 dark:bg-surface-400 text-[10px] text-surface-500 uppercase">
                                <tr>
                                    <th class="p-2 text-left font-bold">Pilih Rak</th>
                                    <th class="p-2 w-24 text-center font-bold">Jumlah</th>
                                    <th class="p-2 w-8"></th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                                <tr v-for="(alloc, aIdx) in u.allocations" :key="aIdx">
                                    <td class="p-1.5">
                                        <Dropdown v-model="alloc.shelfUuid" :options="shelfOptions" optionLabel="name" optionValue="uuid" 
                                            placeholder="Pilih Rak..." class="w-full !h-8 text-xs compact-input dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" 
                                            :pt="{ input: { class: '!py-1 !px-2' }, panel: { class: '!text-xs' } }" />
                                    </td>
                                    <td class="p-1.5">
                                        <InputNumber v-model="alloc.qty" :min="0" class="w-full !h-8 dark:bg-surface-400 dark:text-surface-100 dark:border-surface-700" inputClass="!text-xs !text-center !p-1 font-bold" placeholder="0" />
                                    </td>
                                    <td class="p-1.5 text-center">
                                        <Button icon="pi pi-times" text rounded severity="danger" class="!w-6 !h-6 !p-0" @click="removeStockAllocation(uIdx, aIdx)" />
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
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Produk'" icon="pi pi-check" @click="saveProduct" :loading="loading" size="small" />
            </div>
        </template>
    </Dialog>

    <ShelveCreateModal 
        v-model:visible="showShelfModal" 
        @saved="onShelveCreated" 
    />
</template>

<style scoped>
.section-title {
    @apply text-sm font-bold text-surface-700 dark:text-surface-200 uppercase tracking-wide;
}
.section-box {
    /* Kelas dark:bg-surface-400 dipindahkan ke template */
    @apply rounded-lg shadow-sm overflow-hidden;
}
.table-container {
    @apply border-t border-surface-100 dark:border-surface-700;
}
/* Compact styling */
:deep(.compact-input .p-dropdown-label) {
    padding: 4px 8px !important;
    font-size: 0.75rem !important; 
}
:deep(.compact-multiselect .p-multiselect-label) {
    padding: 4px 8px !important;
}
:deep(.p-inputnumber-input) {
    padding: 4px 8px !important;
}
</style>