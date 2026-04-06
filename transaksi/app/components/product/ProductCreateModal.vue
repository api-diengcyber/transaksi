<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

// --- INJECT SERVICES ---
const productService = useProductService();
const shelveService = useShelveService();
const unitService = useUnitService();
const categoryService = useCategoryService();
const priceGroupService = usePriceGroupService();
const toast = useToast();

// --- STATE ---
const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

const shelves = ref([]);
const units = ref([]);
const categories = ref([]);
const priceGroups = ref([]);

// Data Utama Produk (Sudah disederhanakan tanpa Parent/Child)
const product = reactive({ 
    name: '',
    barcode: '',
    stock: 0,
    unitUuid: null,
    categoryUuid: null,
    shelveUuids: [],
    prices: [],
    variants: []
});

// --- HELPER LOGIKA HARGA GROSIR ---
const getPricePairs = (pricesArray) => {
    if (!pricesArray || pricesArray.length === 0) return [];
    const pairs = [];
    const basePrices = pricesArray.filter(p => !p.name.toLowerCase().includes('grosir'));
    
    basePrices.forEach(bp => {
        let expectedGrosirName = bp.name.toLowerCase().replace('harga', 'harga grosir').trim();
        if (bp.name.toLowerCase().includes('member')) expectedGrosirName = 'harga grosir member';
        if (bp.name.toLowerCase().includes('normal')) expectedGrosirName = 'harga grosir normal';
        
        const grosirPrice = pricesArray.find(p => 
            p.name.toLowerCase() === expectedGrosirName || 
            (p.name.toLowerCase().includes('grosir') && p.name.toLowerCase().includes(bp.name.toLowerCase().replace('harga', '').trim()))
        );
        
        pairs.push({ base: bp, grosir: grosirPrice });
    });
    return pairs;
};

// --- FORM MANAGEMENT ---
const initForm = () => {
    product.name = '';
    product.barcode = '';
    product.stock = 0;
    product.unitUuid = null;
    product.categoryUuid = null;
    product.shelveUuids = [];
    
    product.prices = priceGroups.value.map(pg => {
        const isGrosir = pg.name.toLowerCase().includes('grosir');
        return {
            priceGroupUuid: pg.uuid,
            name: pg.name,
            price: 0,
            minQty: 0
        };
    });
    
    product.variants = [];
    submitted.value = false;
};

const addVariant = () => {
    product.variants.push({ 
        name: '', 
        barcode: '', 
        stock: 0,
        prices: priceGroups.value.map(pg => ({
            priceGroupUuid: pg.uuid,
            name: pg.name,
            price: 0,
            minQty: 0
        })) 
    });
};

const removeVariant = (index) => {
    product.variants.splice(index, 1);
};

const loadDropdowns = async () => {
    try {
        const extractArray = (res) => {
            if (!res) return [];
            if (Array.isArray(res)) return res;
            if (res.data && Array.isArray(res.data)) return res.data;
            if (res.data?.data && Array.isArray(res.data.data)) return res.data.data;
            return [];
        };

        const results = await Promise.allSettled([
            shelveService.getAllShelves(),
            unitService.getAllUnits(),
            categoryService.getAllCategories(),
            priceGroupService.getAllPriceGroups()
        ]);

        shelves.value = results[0].status === 'fulfilled' ? extractArray(results[0].value) : [];
        units.value = results[1].status === 'fulfilled' ? extractArray(results[1].value) : [];
        categories.value = results[2].status === 'fulfilled' ? extractArray(results[2].value) : [];
        priceGroups.value = results[3].status === 'fulfilled' ? extractArray(results[3].value) : [];
    } catch (error) {
        console.error("Gagal memuat master:", error);
    }
};

const loadProductData = async (uuid) => {
    loading.value = true;
    try {
        const response = await productService.getProduct(uuid);
        const data = response.data || response; 

        if (!data) throw new Error("Data produk kosong");

        product.name = data.name || '';
        product.barcode = data.barcode || '';
        product.stock = data.stock || 0;
        product.unitUuid = data.unitUuid || null;
        product.categoryUuid = data.categoryUuid || (data.category ? data.category.uuid : null); 

        if (data.shelves && Array.isArray(data.shelves)) {
            product.shelveUuids = data.shelves.map(shelf => shelf.uuid);
        } else {
            product.shelveUuids = data.shelveUuids || (data.shelveUuid ? [data.shelveUuid] : []);
        }

        product.prices = priceGroups.value.map(pg => {
            const savedPrice = data.prices?.find(p => p.priceGroupUuid === pg.uuid);
            return {
                uuid: savedPrice?.uuid || null,
                priceGroupUuid: pg.uuid,
                name: pg.name,
                price: savedPrice ? Number(savedPrice.price) : 0,
                minQty: savedPrice ? Number(savedPrice.minQty) : 0
            };
        });

        product.variants = (data.variants || []).map(v => ({
            uuid: v.uuid, 
            name: v.name, 
            barcode: v.barcode, 
            stock: v.stock,
            prices: priceGroups.value.map(pg => {
                const savedVariantPrice = v.prices?.find(vp => vp.priceGroupUuid === pg.uuid);
                return {
                    uuid: savedVariantPrice?.uuid || null,
                    priceGroupUuid: pg.uuid,
                    name: pg.name,
                    price: savedVariantPrice ? Number(savedVariantPrice.price) : 0,
                    minQty: savedVariantPrice ? Number(savedVariantPrice.minQty) : 0
                };
            })
        }));

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.' });
        emit('update:visible', false); 
    } finally {
        loading.value = false;
    }
};

watch(() => props.visible, async (val) => {
    if (val) {
        await loadDropdowns(); 
        if (props.productUuid) await loadProductData(props.productUuid);
        else initForm();
    }
});

const saveProduct = async () => {
    submitted.value = true;
    
    if (!product.name || !product.unitUuid || !product.categoryUuid || product.shelveUuids.length === 0) {
        toast.add({ severity: 'warn', summary: 'Perhatian', detail: 'Nama, kategori, satuan, dan rak wajib diisi' });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            name: product.name,
            barcode: product.barcode,
            stock: product.stock,
            unitUuid: product.unitUuid,
            categoryUuid: product.categoryUuid,
            shelveUuids: product.shelveUuids,
            
            // Harga dikosongkan jika ada varian
            prices: product.variants.length === 0 ? product.prices.map(p => ({
                uuid: p.uuid, priceGroupUuid: p.priceGroupUuid, name: p.name, 
                price: p.price, minQty: p.minQty
            })) : [],

            variants: product.variants.map(v => ({
                uuid: v.uuid, name: v.name, barcode: v.barcode, stock: v.stock,
                prices: v.prices.map(vp => ({
                    uuid: vp.uuid, priceGroupUuid: vp.priceGroupUuid, name: vp.name, 
                    price: vp.price, minQty: vp.minQty
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
        const msg = e.response?._data?.message || e.message || 'Error';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'" 
        :modal="true" 
        :style="{ width: '850px' }" 
        class="p-fluid bg-surface-0 rounded-xl overflow-hidden" 
        :pt="{ 
            header: { class: '!bg-surface-50 !border-b !border-surface-200 !py-4' },
            content: { class: '!py-6 !px-6 max-h-[85vh] overflow-y-auto custom-scrollbar' },
            footer: { class: '!bg-surface-50 !border-t !border-surface-200 !py-3 !px-6' }
        }"
    >
        <div class="flex flex-col gap-4">
            <div class="field mb-0">
                <label for="name" class="font-semibold text-sm mb-1.5 block text-surface-700">Nama Produk <span class="text-red-500">*</span></label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100"><i class="pi pi-tag text-surface-500"></i></InputGroupAddon>
                    <InputText id="name" v-model="product.name" placeholder="Contoh: Kopi Kapal Api" :class="{'p-invalid': submitted && !product.name}" autofocus />
                </InputGroup>
            </div>

            <div class="field mb-0">
                <label for="barcode" class="font-semibold text-sm mb-1.5 block text-surface-700">Barcode / SKU</label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100"><i class="pi pi-barcode text-surface-500"></i></InputGroupAddon>
                    <InputText id="barcode" v-model="product.barcode" placeholder="Scan atau ketik kode..." />
                </InputGroup>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">Stok Utama</label>
                    <InputNumber v-model="product.stock" placeholder="0" class="w-full" />
                </div>
                
                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">Satuan <span class="text-red-500">*</span></label>
                    <Dropdown v-model="product.unitUuid" :options="units" optionLabel="name" optionValue="uuid" placeholder="Pilih Satuan" :class="{'p-invalid': submitted && !product.unitUuid}" class="w-full" />
                </div>

                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">Kategori <span class="text-red-500">*</span></label>
                    <Dropdown v-model="product.categoryUuid" :options="categories" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Kategori" :class="{'p-invalid': submitted && !product.categoryUuid}" class="w-full" />
                </div>

                <div class="field mb-0 col-span-1 sm:col-span-3">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">Rak / Lokasi (Bisa Multi) <span class="text-red-500">*</span></label>
                    <MultiSelect v-model="product.shelveUuids" :options="shelves" optionLabel="name" optionValue="uuid" placeholder="Pilih Rak" display="chip" :class="{'p-invalid': submitted && product.shelveUuids.length === 0}" class="w-full" />
                </div>
            </div>

            <div v-if="product.variants.length === 0" class="mt-4 pt-4 border-t border-surface-200">
                <div class="mb-3">
                    <h3 class="font-semibold text-surface-800 text-sm">Pengaturan Harga & Grosir</h3>
                    <p class="text-xs text-surface-500 mt-0.5">Isi Min Grosir > 0 untuk memunculkan kolom Harga Grosir.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-50 p-4 border border-surface-200 rounded-lg">
                    <div v-for="(pair, idx) in getPricePairs(product.prices)" :key="idx" class="field mb-0 bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col gap-3">
                        <label class="text-[11px] font-bold uppercase text-primary-700 border-b border-surface-100 pb-2">{{ pair.base.name }}</label>
                        
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-semibold text-surface-600 w-24">Harga Satuan</span>
                            <InputNumber v-model="pair.base.price" mode="currency" currency="IDR" locale="id-ID" placeholder="Rp" class="flex-1 p-inputtext-sm" />
                        </div>

                        <template v-if="pair.grosir">
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-semibold text-surface-600 w-24">Min Grosir</span>
                                <InputNumber v-model="pair.grosir.minQty" placeholder="0" class="w-24 p-inputtext-sm" inputClass="!text-center !font-bold" :min="0" />
                                <span class="text-[10px] text-surface-400 italic flex-1">Isi > 0 u/ grosir</span>
                            </div>
                            <div v-if="pair.grosir.minQty > 0" class="flex items-center gap-3 mt-1 pt-3 border-t border-dashed border-surface-200 animate-fade-in">
                                <span class="text-xs font-bold text-orange-600 w-24">Harga Grosir</span>
                                <InputNumber v-model="pair.grosir.price" mode="currency" currency="IDR" locale="id-ID" placeholder="Rp" class="flex-1 p-inputtext-sm" inputClass="!font-bold !text-orange-700 !bg-orange-50" />
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-surface-200">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <h3 class="font-semibold text-surface-800 text-sm">Varian Produk</h3>
                        <p class="text-xs text-surface-500 mt-0.5">Tambah variasi Warna/Ukuran dengan harga masing-masing.</p>
                    </div>
                    <Button label="Tambah Varian" icon="pi pi-plus" size="small" outlined severity="secondary" @click="addVariant" />
                </div>

                <div v-if="product.variants.length === 0" class="text-center py-4 text-surface-400 text-sm border border-dashed rounded-lg border-surface-300 bg-surface-50">
                    Tidak ada varian khusus.
                </div>

                <div v-for="(variant, vIdx) in product.variants" :key="vIdx" class="p-4 border border-surface-200 rounded-xl mb-4 bg-surface-50 relative animate-fade-in shadow-sm">
                    <Button icon="pi pi-times" severity="danger" text rounded class="absolute right-2 top-2 h-8 w-8 p-0" @click="removeVariant(vIdx)" />
                    
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div class="field mb-0">
                            <label class="text-xs font-semibold mb-1 block">Nama Varian <span class="text-red-500">*</span></label>
                            <InputText v-model="variant.name" placeholder="Cth: XL / Merah" class="w-full" :class="{'p-invalid': submitted && !variant.name}" />
                        </div>
                        <div class="field mb-0">
                            <label class="text-xs font-semibold mb-1 block">Barcode Varian</label>
                            <InputText v-model="variant.barcode" placeholder="Scan barcode..." class="w-full" />
                        </div>
                        <div class="field mb-0">
                            <label class="text-xs font-semibold mb-1 block">Stok Varian</label>
                            <InputNumber v-model="variant.stock" placeholder="0" class="w-full" />
                        </div>
                    </div>

                    <div class="bg-surface-0 p-3 rounded-lg border border-surface-200">
                        <div class="text-xs font-bold text-primary-600 mb-3 uppercase border-b border-surface-100 pb-2">Harga Varian: {{ variant.name || 'Baru' }}</div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div v-for="(pair, idx) in getPricePairs(variant.prices)" :key="idx" class="field mb-0 bg-surface-50 p-3 rounded-lg border border-surface-100 flex flex-col gap-2 shadow-sm">
                                <label class="text-[10px] font-bold text-surface-500 uppercase border-b border-surface-200 pb-1">{{ pair.base.name }}</label>
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-[10px] font-semibold text-surface-600 w-16">Harga</span>
                                    <InputNumber v-model="pair.base.price" mode="currency" currency="IDR" locale="id-ID" class="p-inputtext-sm flex-1" />
                                </div>
                                <template v-if="pair.grosir">
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="text-[10px] font-semibold text-surface-600 w-16">Min Gros</span>
                                        <InputNumber v-model="pair.grosir.minQty" class="p-inputtext-sm w-20" :min="0" />
                                    </div>
                                    <div v-if="pair.grosir.minQty > 0" class="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-dashed border-surface-200 animate-fade-in">
                                        <span class="text-[10px] font-bold text-orange-600 w-16">Hrg Grosir</span>
                                        <InputNumber v-model="pair.grosir.price" mode="currency" currency="IDR" locale="id-ID" class="p-inputtext-sm flex-1" inputClass="!font-bold !text-orange-700 !bg-orange-50" />
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" size="small" @click="emit('update:visible', false)" />
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Simpan Produk'" icon="pi pi-check" size="small" @click="saveProduct" :loading="loading" severity="primary" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.animate-fade-in { animation: fadeIn 0.2s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>