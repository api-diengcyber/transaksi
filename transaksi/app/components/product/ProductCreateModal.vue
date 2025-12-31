<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import ShelveCreateModal from '~/components/shelve/ShelveCreateModal.vue';

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

// --- INJECT SERVICES ---
const productService = useProductService();
const shelveService = useShelveService();
const categoryService = useCategoryService(); 
const toast = useToast();

// --- STATE ---
const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

// Data Utama
const product = reactive({ 
    name: '', 
    categoryUuids: [] 
});

// Konfigurasi Dinamis
const configUnits = ref([]); 
const configPrices = ref([]);

// Options
const showShelfModal = ref(false);
const shelfOptions = ref([]); 
const categoryOptions = ref([]); 
const unitOptions = ['PCS', 'BOX', 'KG', 'LITER', 'PACK', 'CARTON', 'DUS', 'LUSIN'];

// --- FETCH REFERENCE DATA ---

const fetchShelves = async () => {
    try {
        const res = await shelveService.getAllShelves(); 
        shelfOptions.value = Array.isArray(res) ? res : (res.data || []);
    } catch (e) { console.error(e); }
};

const fetchCategories = async () => {
    try {
        const res = await categoryService.getAllCategorys(); 
        const rawData = Array.isArray(res) ? res : (res.data || []);
        categoryOptions.value = rawData.map(c => ({
            label: c.name,
            value: c.uuid
        }));
    } catch (e) { console.error(e); }
};

const onShelveCreated = () => fetchShelves(); 

// --- FORM MANAGEMENT ---

const initForm = () => {
    // 1. Reset Data Reaktif
    product.name = '';
    product.categoryUuids = []; 
    
    // 2. Reset Tabel Satuan & Harga ke Default
    const tempId = Date.now();
    configUnits.value = [{ 
        tempId, 
        uuid: null,
        unitName: 'PCS', 
        multiplier: 1, 
        barcode: '', 
        isDefault: true, 
        allocations: [],
        oldQty: 0,
        newQty: 0, 
    }]; 
    configPrices.value = [{ 
        tempId: tempId + 1, 
        uuid: null,
        unitTempId: tempId, 
        name: 'Umum', 
        price: 0, 
        minWholesaleQty: 0, 
        isDefault: true 
    }]; 
    
    submitted.value = false;
};

// --- LOAD DATA (FIXED) ---
const loadProductData = async (uuid) => {
    loading.value = true;
    try {
        const response = await productService.getProduct(uuid);
        const data = response.data || response; 

        if (!data) throw new Error("Data produk kosong dari server");

        // 1. Isi Basic Info
        product.name = data.name || '';
        
        // 2. Isi Kategori
        const cats = data.productCategory || [];
        product.categoryUuids = Array.isArray(cats) 
            ? cats.map(pc => pc.category?.uuid).filter(Boolean) 
            : [];

        // 3. Mapping Units 
        const units = data.units || [];
        configUnits.value = units.map(u => {
            const currentQty = Number(u.currentStock || 0); 
            return {
                uuid: u.uuid, 
                tempId: u.uuid, 
                unitName: u.unitName,
                multiplier: Number(u.unitMultiplier),
                barcode: u.barcode,
                isDefault: data.defaultUnitUuid === u.uuid,
                allocations: [],
                oldQty: currentQty,
                newQty: currentQty, 
            };
        });

        // 4. Mapping Prices
        const prices = data.prices || data.price || [];
        configPrices.value = prices.map(p => ({
            uuid: p.uuid,
            tempId: Date.now() + Math.random(), 
            unitTempId: p.unitUuid,
            name: p.name,
            price: Number(p.price),
            minWholesaleQty: Number(p.minWholesaleQty) || 0, 
            isDefault: data.defaultPriceUuid === p.uuid
        }));

        // 5. Mapping Shelves
        const allShelves = data.shelve || [];
        configUnits.value.forEach(unitItem => {
            const related = allShelves.filter(s => s.unitUuid === unitItem.uuid);
            if (related.length > 0) {
                unitItem.allocations = related.map(rs => ({
                    shelfUuid: rs.shelveUuid || rs.shelveId,
                    qty: Number(rs.qty)
                }));
            }
        });

    } catch (error) {
        console.error("Load Error:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.' });
        emit('update:visible', false); 
    } finally {
        loading.value = false;
    }
};

// --- WATCHERS (CRITICAL FIX) ---
watch(() => props.visible, async (val) => {
    if (val) {
        // [PENTING] Tunggu update prop selesai dari parent
        await nextTick(); 
        
        // Selalu bersihkan form dulu agar tidak muncul data produk sebelumnya
        initForm();
        
        // Load referensi
        await Promise.all([fetchShelves(), fetchCategories()]);
        
        // Cek props.productUuid langsung setelah nextTick
        if (props.productUuid) {
            await loadProductData(props.productUuid);
        }
    }
});

// --- ACTIONS (ADD/REMOVE ROWS) ---
const addUnitRow = () => {
    const newId = Date.now();
    const isFirst = configUnits.value.length === 0;
    configUnits.value.push({ 
        tempId: newId, uuid: null, unitName: 'PCS', multiplier: 1, barcode: '', 
        isDefault: isFirst, allocations: [], oldQty: 0, newQty: 0,
    });
    configPrices.value.push({ 
        tempId: newId + 1, uuid: null, unitTempId: newId, name: 'Umum', 
        price: 0, minWholesaleQty: 0, isDefault: isFirst 
    });
};

const removeUnitRow = (index) => {
    if (configUnits.value.length <= 1) return;
    const removed = configUnits.value[index];
    configUnits.value.splice(index, 1);
    configPrices.value = configPrices.value.filter(p => p.unitTempId !== removed.tempId);
    if (removed.isDefault && configUnits.value.length > 0) {
        configUnits.value[0].isDefault = true;
    }
};
const setUnitDefault = (index) => { configUnits.value.forEach((u, i) => u.isDefault = (i === index)); };

const addPriceRow = () => {
    const defaultUnit = configUnits.value[0];
    if(!defaultUnit) return;
    configPrices.value.push({ tempId: Date.now(), uuid: null, unitTempId: defaultUnit.tempId, name: '', price: 0, minWholesaleQty: 0, isDefault: false });
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
    if (!product.name) {
        toast.add({ severity: 'warn', detail: 'Nama produk wajib diisi' });
        return;
    }

    loading.value = true;
    try {
        // Payload Stock Adjustment
        const stockAdjustments = [];
        configUnits.value.forEach(u => {
            const oldQ = Number(u.oldQty) || 0;
            const newQ = Number(u.newQty) || 0;
            if (newQ !== oldQ) { 
                stockAdjustments.push({
                    unitUuid: u.uuid || u.tempId, 
                    oldQty: oldQ,
                    newQty: newQ
                });
            }
        });

        const payload = {
            name: product.name,
            categoryUuids: product.categoryUuids, 
            units: configUnits.value.map(u => ({
                uuid: u.uuid, 
                tempId: u.tempId, 
                name: u.unitName,
                multiplier: Number(u.multiplier),
                barcode: u.barcode,
                isDefault: u.isDefault
            })),
            prices: configPrices.value.map(p => ({
                uuid: p.uuid, 
                unitTempId: p.unitTempId, 
                name: p.name || 'Umum',
                price: Number(p.price),
                minWholesaleQty: Number(p.minWholesaleQty),
                isDefault: p.isDefault
            })),
            stockAdjustments: stockAdjustments,
            stocks: configUnits.value.map(u => ({
                unitTempId: u.tempId,
                qty: 0, 
                allocations: u.allocations
                    .filter(a => a.shelfUuid && a.qty > 0)
                    .map(a => ({
                        shelfUuid: a.shelfUuid,
                        qty: Number(a.qty)
                    }))
            }))
        };

        if (isEditMode.value) {
            await productService.updateProduct(props.productUuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk diperbarui' });
            emit('product-updated');
        } else {
            await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk dibuat' });
            emit('product-created');
        }
        emit('update:visible', false);
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan sistem' });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Produk' : 'Produk Baru'" 
        :modal="true" 
        :style="{ width: '900px' }" 
        maximizable 
        class="p-fluid" 
        :pt="{ content: { class: '!py-2 dark:bg-surface-100' } }"
    >
        
        <div class="p-4 rounded-lg border border-surface-200 dark:border-surface-700 mb-6 bg-surface-0 dark:bg-surface-100">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="field mb-0">
                    <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Nama Produk <span class="text-red-500">*</span></label>
                    <InputText v-model="product.name" placeholder="Contoh: Kopi Kapal Api" class="w-full !h-9 text-sm" :class="{'p-invalid': submitted && !product.name}" />
                    <small class="text-red-500 text-[10px] mt-1" v-if="submitted && !product.name">Wajib diisi.</small>
                </div>

                <div class="field mb-0">
                    <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Kategori</label>
                    <MultiSelect 
                        v-model="product.categoryUuids" 
                        :options="categoryOptions" 
                        optionLabel="label" 
                        optionValue="value" 
                        placeholder="Pilih Kategori" 
                        display="chip" 
                        filter
                        class="w-full !min-h-[2.25rem] text-xs"
                    />
                </div>
            </div>
        </div>

        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-100 rounded border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div class="flex justify-between items-center p-2 bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                <span class="text-sm font-bold flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px]">1</span>
                    Satuan & Barcode
                </span>
                <Button label="Tambah" icon="pi pi-plus" size="small" text severity="primary" @click="addUnitRow" class="!py-0.5 !text-xs" />
            </div>
            <div class="p-0 overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-700 text-surface-500 uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center">Def</th>
                            <th class="p-2 w-32">Satuan</th>
                            <th class="p-2 w-20">Multiplier</th>
                            <th class="p-2">Barcode</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
                        <tr v-for="(u, idx) in configUnits" :key="u.tempId">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="u.isDefault" :value="true" name="uDef" @change="setUnitDefault(idx)" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="u.unitName" :options="unitOptions" editable placeholder="Pilih" class="w-full !h-8 text-xs" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputNumber v-model="u.multiplier" :min="1" class="w-full !h-8" inputClass="!text-xs !text-center !p-1" :disabled="u.isDefault" />
                            </td>
                            <td class="p-2 align-middle">
                                <InputText v-model="u.barcode" class="w-full !h-8 !text-xs !p-1" placeholder="Scan..." />
                            </td>
                            <td class="p-2 text-center align-middle">
                                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removeUnitRow(idx)" class="!w-6 !h-6" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-100 rounded border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div class="flex justify-between items-center p-2 bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                <span class="text-sm font-bold flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">2</span>
                    Harga Jual
                </span>
                <Button label="Tambah" icon="pi pi-plus" size="small" text severity="success" @click="addPriceRow" class="!py-0.5 !text-xs" />
            </div>
            <div class="p-0 overflow-x-auto">
                <table class="w-full text-xs">
                    <thead class="bg-surface-100 dark:bg-surface-700 text-surface-500 uppercase font-bold">
                        <tr>
                            <th class="p-2 w-10 text-center">Def</th>
                            <th class="p-2">Nama Harga</th>
                            <th class="p-2 w-32">Satuan</th>
                            <th class="p-2 w-20">Min Qty</th>
                            <th class="p-2 w-32">Harga (Rp)</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
                        <tr v-for="(p, idx) in configPrices" :key="p.tempId">
                            <td class="p-2 text-center align-middle"><RadioButton v-model="p.isDefault" :value="true" name="pDef" @change="setPriceDefault(idx)" /></td>
                            <td class="p-2 align-middle"><InputText v-model="p.name" class="w-full !h-8 !text-xs !p-1" placeholder="Umum" /></td>
                            <td class="p-2 align-middle">
                                <Dropdown v-model="p.unitTempId" :options="configUnits" optionLabel="unitName" optionValue="tempId" class="w-full !h-8 text-xs" />
                            </td>
                            <td class="p-2 align-middle"><InputNumber v-model="p.minWholesaleQty" :min="0" class="w-full !h-8" inputClass="!text-xs !text-center !p-1" /></td>
                            <td class="p-2 align-middle"><InputNumber v-model="p.price" mode="currency" currency="IDR" locale="id-ID" class="w-full !h-8" inputClass="!text-xs !text-right !p-1" /></td>
                            <td class="p-2 text-center align-middle">
                                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="removePriceRow(idx)" class="!w-6 !h-6" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="section-box mb-6 bg-surface-0 dark:bg-surface-100 rounded border border-surface-200 dark:border-surface-700 overflow-hidden">
             <div class="p-2 bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                <span class="text-sm font-bold flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px]">3</span>
                    {{ isEditMode ? 'Opname Stok' : 'Stok Awal' }}
                </span>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
                <div v-for="u in configUnits" :key="u.tempId" class="p-2 border border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-700/30">
                    <div class="text-[10px] uppercase font-bold text-surface-500 mb-1">{{ u.unitName }}</div>
                    <div v-if="isEditMode" class="text-[10px] mb-1 flex justify-between">
                        <span>Lama:</span> <span class="font-bold">{{ u.oldQty }}</span>
                    </div>
                    <InputNumber v-model="u.newQty" :min="0" class="w-full !h-8" inputClass="!text-xs !text-center !font-bold" placeholder="0" />
                </div>
            </div>
        </div>

        <div class="section-box bg-surface-0 dark:bg-surface-100 rounded border border-surface-200 dark:border-surface-700 overflow-hidden">
             <div class="flex justify-between items-center p-2 bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                <span class="text-sm font-bold flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px]">4</span>
                    Lokasi Rak
                </span>
                <Button label="Rak Baru" icon="pi pi-plus-circle" size="small" text severity="help" @click="showShelfModal = true" class="!py-0.5 !text-xs" />
            </div>
            <div class="p-3 space-y-3">
                <div v-for="(u, uIdx) in configUnits" :key="u.tempId" class="border border-surface-200 dark:border-surface-700 rounded p-2">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-surface-600 dark:text-surface-300">{{ u.unitName }}</span>
                        <Button label="Tambah Lokasi" icon="pi pi-plus" size="small" outlined severity="secondary" class="!py-0 !px-2 !h-6 !text-[10px]" @click="addStockAllocation(uIdx)" />
                    </div>
                    <div v-if="!u.allocations.length" class="text-[10px] text-surface-400 italic text-center py-1">Belum ada lokasi</div>
                    <div v-else class="space-y-1">
                        <div v-for="(alloc, aIdx) in u.allocations" :key="aIdx" class="flex gap-2 items-center">
                            <Dropdown v-model="alloc.shelfUuid" :options="shelfOptions" optionLabel="name" optionValue="uuid" placeholder="Rak..." class="w-full !h-7 text-[10px]" />
                            <InputNumber v-model="alloc.qty" placeholder="Qty" class="w-16 !h-7" inputClass="!text-[10px] !text-center !p-1" />
                            <Button icon="pi pi-times" text rounded severity="danger" size="small" class="!w-6 !h-6" @click="removeStockAllocation(uIdx, aIdx)" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2 border-t border-surface-200 dark:border-surface-700">
                <Button label="Batal" icon="pi pi-times" text @click="emit('update:visible', false)" severity="secondary" size="small" />
                <Button :label="isEditMode ? 'Simpan' : 'Buat'" icon="pi pi-check" @click="saveProduct" :loading="loading" size="small" />
            </div>
        </template>
    </Dialog>

    <ShelveCreateModal v-model:visible="showShelfModal" @saved="onShelveCreated" />
</template>