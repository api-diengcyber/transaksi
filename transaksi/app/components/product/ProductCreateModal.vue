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
const categoryService = useCategoryService(); // <-- Tambahkan Service Kategori
const toast = useToast();

// --- STATE ---
const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

const shelves = ref([]);
const units = ref([]);
const categories = ref([]); // <-- State untuk Kategori
const existingProducts = ref([]); 

// Data Utama Produk
const product = reactive({ 
    name: '',
    barcode: '',
    stock: 0,
    unitUuid: null,
    categoryUuid: null, // <-- Form Kategori
    conversionQty: 1, 
    shelveUuids: [],
    
    // State Varian
    variants: [],

    // State Parent
    hasParent: false,
    parentOption: 'existing',
    parentProductUuid: null,
    parentNewName: '',
    parentNewBarcode: '',
    parentNewUnitUuid: null,

    // State Child
    children: [] 
});

// --- FORM MANAGEMENT ---
const initForm = () => {
    product.name = '';
    product.barcode = '';
    product.stock = 0;
    product.unitUuid = null;
    product.categoryUuid = null; // Reset kategori
    product.conversionQty = 1;
    product.shelveUuids = [];
    
    product.variants = [];
    
    product.hasParent = false;
    product.parentOption = 'existing';
    product.parentProductUuid = null;
    product.parentNewName = '';
    product.parentNewBarcode = '';
    product.parentNewUnitUuid = null;
    
    product.children = [];
    submitted.value = false;
};

// Varian Handlers
const addVariant = () => {
    product.variants.push({ name: '', barcode: '', stock: 0 });
};
const removeVariant = (index) => {
    product.variants.splice(index, 1);
};

// Child Handlers
const addChild = () => {
    product.children.push({
        name: product.name ? `${product.name} (Eceran/Child)` : '', 
        barcode: '', unitUuid: null, conversionQty: 1 
    });
};
const removeChild = (index) => {
    product.children.splice(index, 1);
};

// --- LOAD DROPDOWN DATA ---
const loadDropdowns = async () => {
    try {
        const [shelvesRes, unitsRes, categoriesRes, productsRes] = await Promise.all([
            shelveService.getAllShelves(),
            unitService.getAllUnits(),
            categoryService.getAllCategories(), // <-- Panggil API Kategori
            productService.getAllProducts(1, 1000) 
        ]);
        
        shelves.value = shelvesRes.data || shelvesRes;
        units.value = unitsRes.data || unitsRes;
        
        // Sesuaikan dengan format response API kategori Anda
        categories.value = categoriesRes.data?.data || categoriesRes.data || categoriesRes;
        
        existingProducts.value = productsRes.data?.data || productsRes.data || productsRes;
    } catch (error) {
        console.error("Gagal memuat data relasi:", error);
    }
};

// --- LOAD DATA (Edit Mode) ---
const loadProductData = async (uuid) => {
    loading.value = true;
    try {
        const response = await productService.getProduct(uuid);
        const data = response.data || response; 

        if (!data) throw new Error("Data produk kosong dari server");

        product.name = data.name || '';
        product.barcode = data.barcode || '';
        product.stock = data.stock || 0;
        product.unitUuid = data.unitUuid || null;
        product.categoryUuid = data.categoryUuid || (data.category ? data.category.uuid : null); // <-- Load Kategori
        product.conversionQty = data.conversionQty || 1; 
        product.shelveUuids = data.shelveUuids || (data.shelveUuid ? [data.shelveUuid] : []);

        // Load Varian
        if (data.variants && data.variants.length > 0) {
            product.variants = data.variants.map(v => ({
                uuid: v.uuid, name: v.name, barcode: v.barcode, stock: v.stock
            }));
        }

        // Load relasi Parent
        if (data.parentProduct) {
            product.hasParent = true;
            product.parentOption = 'existing';
            product.parentProductUuid = data.parentProduct.uuid || null;
        }

        // Load relasi Child
        if (data.childProducts && data.childProducts.length > 0) {
            product.children = data.childProducts.map(c => ({
                name: c.name, barcode: c.barcode, unitUuid: c.unitUuid, conversionQty: c.conversionQty || 1
            }));
        }

    } catch (error) {
        console.error("Load Error:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.' });
        emit('update:visible', false); 
    } finally {
        loading.value = false;
    }
};

// --- WATCHERS ---
watch(() => props.visible, async (val) => {
    if (val) {
        initForm();
        await loadDropdowns(); 
        if (props.productUuid) {
            await loadProductData(props.productUuid);
        }
    }
});

// Watcher untuk reset konversi jika checkbox parent di-uncheck
watch(() => product.hasParent, (newVal) => {
    if (!newVal) {
        product.conversionQty = 1;
    }
});

// --- SAVE / UPDATE ---
const saveProduct = async () => {
    submitted.value = true;
    
    // Tambahkan validasi Kategori
    if (!product.name || !product.unitUuid || !product.categoryUuid || product.shelveUuids.length === 0) {
        toast.add({ severity: 'warn', summary: 'Perhatian', detail: 'Nama, kategori, satuan, dan minimal 1 rak wajib diisi' });
        return;
    }

    if (product.hasParent && product.conversionQty < 1) {
        toast.add({ severity: 'warn', summary: 'Perhatian', detail: 'Nilai konversi harus lebih dari 0' });
        return;
    }

    const invalidVariant = product.variants.find(v => !v.name.trim());
    if (invalidVariant) {
        toast.add({ severity: 'warn', summary: 'Perhatian', detail: 'Nama varian tidak boleh kosong' });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            name: product.name,
            barcode: product.barcode,
            stock: product.stock,
            unitUuid: product.unitUuid,
            categoryUuid: product.categoryUuid, // <-- Kirim Kategori
            shelveUuids: product.shelveUuids,
            conversionQty: product.hasParent ? product.conversionQty : 1, // Pastikan 1 jika tidak ada parent
            
            variants: product.variants.map(v => ({
                uuid: v.uuid, name: v.name, barcode: v.barcode, stock: v.stock
            })),
            
            parentProduct: product.hasParent ? {
                isNew: product.parentOption === 'new',
                uuid: product.parentOption === 'existing' ? product.parentProductUuid : null,
                name: product.parentOption === 'new' ? product.parentNewName : null,
                barcode: product.parentOption === 'new' ? product.parentNewBarcode : null,
                unitUuid: product.parentOption === 'new' ? product.parentNewUnitUuid : null,
                conversionQty: product.conversionQty 
            } : null,

            childProducts: product.children.length > 0 ? product.children.map(c => ({
                name: c.name, barcode: c.barcode, unitUuid: c.unitUuid, conversionQty: c.conversionQty
            })) : []
        };

        if (isEditMode.value) {
            await productService.updateProduct(props.productUuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil diperbarui' });
            emit('product-updated');
        } else {
            await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil dibuat' });
            emit('product-created');
        }
        emit('update:visible', false);
    } catch (e) {
        console.error(e);
        const msg = e.response?._data?.message || e.message || 'Terjadi kesalahan sistem';
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
        :style="{ width: '750px' }" 
        class="p-fluid bg-surface-0 rounded-xl overflow-hidden" 
        :pt="{ 
            header: { class: '!bg-surface-50 !border-b !border-surface-200 !py-4' },
            content: { class: '!py-6 !px-6 max-h-[85vh] overflow-y-auto' },
            footer: { class: '!bg-surface-50 !border-t !border-surface-200 !py-3 !px-6' }
        }"
    >
        <div class="flex flex-col gap-4">
            
            <div class="field mb-0">
                <label for="name" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Nama Produk <span class="text-red-500">*</span>
                </label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100 !border-surface-300">
                        <i class="pi pi-tag text-surface-500"></i>
                    </InputGroupAddon>
                    <InputText 
                        id="name" 
                        v-model="product.name" 
                        placeholder="Contoh: Kopi Kapal Api" 
                        :class="{'p-invalid': submitted && !product.name}" 
                        class="!border-surface-300 focus:!border-primary-500"
                        autofocus
                    />
                </InputGroup>
                <small class="text-red-500 text-xs mt-1 block" v-if="submitted && !product.name">Nama produk wajib diisi.</small>
            </div>

            <div class="field mb-0">
                <label for="barcode" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Barcode / SKU (Umum)
                </label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100 !border-surface-300">
                        <i class="pi pi-barcode text-surface-500"></i>
                    </InputGroupAddon>
                    <InputText 
                        id="barcode" 
                        v-model="product.barcode" 
                        placeholder="Scan atau ketik kode..." 
                        class="!border-surface-300 focus:!border-primary-500"
                    />
                </InputGroup>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">Stok Utama</label>
                    <InputNumber v-model="product.stock" placeholder="0" class="w-full" />
                </div>
                
                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">
                        Satuan <span class="text-red-500">*</span>
                    </label>
                    <Dropdown 
                        v-model="product.unitUuid" 
                        :options="units" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Pilih Satuan" 
                        :class="{'p-invalid': submitted && !product.unitUuid}"
                        class="w-full"
                    />
                </div>

                <div class="field mb-0">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">
                        Kategori <span class="text-red-500">*</span>
                    </label>
                    <Dropdown 
                        v-model="product.categoryUuid" 
                        :options="categories" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        filter
                        placeholder="Pilih Kategori" 
                        :class="{'p-invalid': submitted && !product.categoryUuid}"
                        class="w-full"
                    />
                </div>

                <div class="field mb-0 col-span-1 sm:col-span-3">
                    <label class="font-semibold text-sm mb-1.5 block text-surface-700">
                        Rak / Lokasi (Bisa Multi) <span class="text-red-500">*</span>
                    </label>
                    <MultiSelect 
                        v-model="product.shelveUuids" 
                        :options="shelves" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Pilih Rak" 
                        display="chip"
                        :class="{'p-invalid': submitted && product.shelveUuids.length === 0}"
                        class="w-full"
                    />
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-surface-200">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <h3 class="font-semibold text-surface-800 text-sm">Varian Produk (Opsional)</h3>
                        <p class="text-xs text-surface-500 mt-0.5">Tambah variasi seperti Warna, Ukuran, atau Rasa.</p>
                    </div>
                    <Button label="Tambah Varian" icon="pi pi-plus" size="small" outlined severity="secondary" @click="addVariant" />
                </div>

                <div v-if="product.variants.length === 0" class="text-center py-4 text-surface-400 text-sm border border-dashed rounded-lg border-surface-300">
                    Tidak ada varian khusus.
                </div>

                <div 
                    v-for="(variant, index) in product.variants" 
                    :key="index" 
                    class="p-4 border border-surface-200 rounded-lg mb-3 bg-surface-50 relative animate-fade-in"
                >
                    <Button icon="pi pi-times" text rounded severity="danger" class="absolute right-2 top-2 h-8 w-8 p-0" @click="removeVariant(index)" />
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                        <div class="field sm:col-span-1 mb-0">
                            <label class="text-xs font-semibold mb-1 block">Nama Varian <span class="text-red-500">*</span></label>
                            <InputText v-model="variant.name" placeholder="Cth: Merah, Pedas, XL" class="w-full" :class="{'p-invalid': submitted && !variant.name}" />
                        </div>
                        <div class="field sm:col-span-1 mb-0">
                            <label class="text-xs font-semibold mb-1 block">Barcode Spesifik</label>
                            <InputText v-model="variant.barcode" placeholder="Scan barcode..." class="w-full" />
                        </div>
                        <div class="field sm:col-span-1 mb-0">
                            <label class="text-xs font-semibold mb-1 block">Stok Varian</label>
                            <InputNumber v-model="variant.stock" placeholder="0" class="w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-surface-200">
                <div class="flex items-center gap-2 mb-3">
                    <Checkbox v-model="product.hasParent" inputId="hasParent" binary />
                    <label for="hasParent" class="font-semibold cursor-pointer text-surface-800 text-sm">
                        Produk ini memiliki Induk/Parent? (Maks 1)
                    </label>
                </div>

                <div v-if="product.hasParent" class="p-4 border border-surface-200 rounded-lg bg-surface-50 mb-0 animate-fade-in">
                    <div class="field mb-4 pb-4 border-b border-surface-200">
                        <label class="font-semibold text-sm mb-1.5 block text-primary-700">
                            Isi / Konversi Produk ini (Qty) <span class="text-red-500">*</span>
                        </label>
                        <InputNumber 
                            v-model="product.conversionQty" 
                            placeholder="1" 
                            class="w-full sm:w-1/2 border-primary-300" 
                            :class="{'p-invalid': submitted && product.conversionQty < 1}"
                        />
                        <small class="text-surface-500 text-[11px] mt-1 block">
                            Cth: Jika produk ini <b>Pcs</b> & Parent-nya di bawah adalah <b>Dus</b>, isi <b>12</b> (karena 1 Dus = 12 Pcs).
                        </small>
                    </div>

                    <div class="flex gap-4 mb-4">
                        <div class="flex items-center">
                            <RadioButton v-model="product.parentOption" inputId="p_exist" value="existing" />
                            <label for="p_exist" class="ml-2 cursor-pointer text-sm">Pilih Produk Ada</label>
                        </div>
                        <div class="flex items-center">
                            <RadioButton v-model="product.parentOption" inputId="p_new" value="new" />
                            <label for="p_new" class="ml-2 cursor-pointer text-sm">Buat Parent Baru</label>
                        </div>
                    </div>
                    
                    <div v-if="product.parentOption === 'existing'" class="field mb-0">
                        <label class="text-xs font-semibold mb-1 block">Cari Produk Parent</label>
                        <Dropdown v-model="product.parentProductUuid" :options="existingProducts" optionLabel="name" optionValue="uuid" filter placeholder="Ketik nama produk..." class="w-full" />
                    </div>
                    
                    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-0">
                        <div class="field col-span-2">
                            <label class="text-xs font-semibold mb-1 block">Nama Parent (Cth: Kopi Kapal Api Dus)</label>
                            <InputText v-model="product.parentNewName" placeholder="Nama parent baru..." class="w-full" />
                        </div>
                        <div class="field">
                            <label class="text-xs font-semibold mb-1 block">Satuan Parent (Cth: Dus/Box)</label>
                            <Dropdown v-model="product.parentNewUnitUuid" :options="units" optionLabel="name" optionValue="uuid" placeholder="Pilih Satuan" class="w-full" />
                        </div>
                        <div class="field">
                            <label class="text-xs font-semibold mb-1 block">Barcode Parent</label>
                            <InputText v-model="product.parentNewBarcode" placeholder="Scan barcode..." class="w-full" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-surface-200">
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <h3 class="font-semibold text-surface-800 text-sm">Produk Turunan / Child</h3>
                        <p class="text-xs text-surface-500 mt-0.5">Tambah eceran/turunan dari produk ini.</p>
                    </div>
                    <Button label="Tambah Child" icon="pi pi-plus" size="small" outlined severity="secondary" @click="addChild" />
                </div>

                <div v-if="product.children.length === 0" class="text-center py-5 text-surface-400 text-sm border border-dashed rounded-lg border-surface-300">
                    Tidak ada produk turunan/child.
                </div>

                <div 
                    v-for="(child, index) in product.children" 
                    :key="index" 
                    class="p-4 border border-surface-200 rounded-lg mb-3 bg-surface-50 relative animate-fade-in"
                >
                    <Button icon="pi pi-times" text rounded severity="danger" class="absolute right-2 top-2 h-8 w-8 p-0" @click="removeChild(index)" />
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div class="field col-span-2 sm:col-span-1">
                            <label class="text-xs font-semibold mb-1 block text-primary-600">Nilai Konversi (Qty)</label>
                            <InputNumber v-model="child.conversionQty" placeholder="Berapa pcs isinya?" class="w-full" />
                        </div>
                        <div class="field col-span-2 sm:col-span-1">
                            <label class="text-xs font-semibold mb-1 block">Satuan Child</label>
                            <Dropdown v-model="child.unitUuid" :options="units" optionLabel="name" optionValue="uuid" placeholder="Pilih Satuan (Cth: Pcs)" class="w-full" />
                        </div>
                        <div class="field col-span-2">
                            <label class="text-xs font-semibold mb-1 block">Nama Produk Turunan</label>
                            <InputText v-model="child.name" placeholder="Contoh: Kopi Kapal Api Pcs" class="w-full" />
                        </div>
                        <div class="field col-span-2">
                            <label class="text-xs font-semibold mb-1 block">Barcode Child</label>
                            <InputText v-model="child.barcode" placeholder="Scan barcode kemasan kecil..." class="w-full" />
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
.animate-fade-in {
    animation: fadeIn 0.2s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>