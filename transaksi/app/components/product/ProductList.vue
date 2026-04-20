<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import ProductBarcodePrintModal from '~/components/product/ProductBarcodePrintModal.vue';

const emit = defineEmits(['create', 'edit']);

// --- INJECT SERVICES ---
const productService = useProductService();
const categoryService = useCategoryService();
const shelveService = useShelveService(); 
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const products = ref([]);
const categories = ref([]);
const shelves = ref([]); 
const loading = ref(true);
const expandedRows = ref({});
const totalRecords = ref(0);

// Filter & Pagination
const searchQuery = ref('');
let searchTimeout = null;
const lazyParams = ref({ page: 1, limit: 10 });

const selectedProducts = ref([]);
const showBarcodeModal = ref(false);

// --- FETCH DATA ---
const fetchCategories = async () => {
    try {
        const res = await categoryService.getAllCategories();
        categories.value = res?.data?.data || res?.data || res || [];
    } catch (error) {
        console.error("Gagal load kategori:", error);
    }
};

const fetchShelves = async () => {
    try {
        const res = await shelveService.getAllShelves();
        shelves.value = res?.data?.data || res?.data || res || [];
    } catch (error) {
        console.error("Gagal load rak:", error);
    }
};

const fetchProducts = async () => {
    loading.value = true;
    try {
        const res = await productService.getAllProducts(
            lazyParams.value.page,
            lazyParams.value.limit,
            searchQuery.value
        );
        
        products.value = res?.data?.data || res?.data || res || [];
        totalRecords.value = res?.meta?.totalItems || res?.data?.meta?.totalItems || products.value.length || 0;
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat daftar produk' });
    } finally {
        loading.value = false;
    }
};

// --- HELPERS ---
const getCategoryName = (uuid) => {
    if (!uuid) return 'Tanpa Kategori';
    const cat = categories.value.find(c => c.uuid === uuid);
    return cat ? cat.name : 'Tanpa Kategori';
};

const getShelveNames = (product) => {
    if (product.shelves && Array.isArray(product.shelves) && product.shelves.length > 0) {
        return product.shelves.map(s => s.name).join(', ');
    }
    if (product.shelveUuids && Array.isArray(product.shelveUuids) && product.shelveUuids.length > 0) {
        return product.shelveUuids.map(uuid => {
            const shelf = shelves.value.find(s => s.uuid === uuid);
            return shelf ? shelf.name : 'Unknown';
        }).join(', ');
    }
    return '-';
};

const getBasePrice = (pricesArray) => {
    if (!pricesArray || pricesArray.length === 0) return 0;
    const nonGrosir = pricesArray.find(p => !p.name?.toLowerCase().includes('grosir') && !p.name?.toLowerCase().includes('member'));
    return nonGrosir ? nonGrosir.price : pricesArray[0].price;
};

// --- HANDLERS ---
const onPage = (event) => {
    lazyParams.value.page = event.page + 1; 
    lazyParams.value.limit = event.rows;
    fetchProducts();
};

const onSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        lazyParams.value.page = 1; 
        fetchProducts();
    }, 500); 
};

const editProduct = (product) => {
    emit('edit', product);
};

const deleteProduct = (event, product) => {
    confirm.require({
        target: event.currentTarget, 
        message: `Apakah Anda yakin ingin menghapus produk "${product.name}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await productService.deleteProduct(product.uuid);
                toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil dihapus' });
                fetchProducts();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal menghapus produk' });
            }
        }
    });
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
};

const openBarcodePrintModal = () => {
    if (selectedProducts.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Pilih Produk', detail: 'Pilih minimal 1 produk terlebih dahulu', life: 3000 });
        return;
    }
    showBarcodeModal.value = true;
};

// --- STATE BARU ---
const showBreakModal = ref(false);
const selectedProductToBreak = ref(null);

// --- HANDLERS BARU ---
const openBreakModal = (product) => {
    selectedProductToBreak.value = product;
    showBreakModal.value = true;
};

const handleBreakSuccess = () => {
    fetchProducts(); 
};

defineExpose({ fetchProducts });

onMounted(async () => {
    await Promise.all([
        fetchCategories(),
        fetchShelves()
    ]);
    await fetchProducts();
});
</script>

<template>

    <div class="flex mb-3">
        <Button label="Tambah Produk" icon="pi pi-plus" @click="emit('create')" class="whitespace-nowrap mr-4" />
        <div>
                <Button 
                label="Cetak Barcode" 
                icon="pi pi-barcode" 
                severity="secondary" 
                outlined
                :disabled="selectedProducts.length === 0"
                @click="openBarcodePrintModal" 
                />
                <span class="text-xs text-surface-500 ml-2" v-if="selectedProducts.length > 0">
                {{ selectedProducts.length }} produk dipilih
                </span>
        </div>
    </div>

    <div class="card bg-surface-0 p-5 rounded-xl border border-surface-200">
        
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
                <h2 class="text-xl font-bold text-surface-800">Master Produk</h2>
                <p class="text-sm text-surface-500 mt-1">Kelola data barang, harga, dan lokasi rak.</p>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <IconField iconPosition="left" class="w-full sm:w-64">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="searchQuery" @input="onSearch" placeholder="Cari nama atau barcode..." class="w-full" />
                </IconField>
            </div>
        </div>

        <DataTable 
            v-model:expandedRows="expandedRows" 
            v-model:selection="selectedProducts"
            :value="products" 
            dataKey="uuid"
            :loading="loading"
            lazy
            :paginator="true"
            :rows="lazyParams.limit"
            :totalRecords="totalRecords"
            @page="onPage"
            :rowsPerPageOptions="[10, 20, 50]"
            responsiveLayout="scroll"
            class="p-datatable-sm"
        >
            <template #empty>
                <div class="text-center py-8 text-surface-500">
                    <i class="pi pi-box text-4xl mb-3 text-surface-300"></i>
                    <p>Data produk tidak ditemukan.</p>
                </div>
            </template>

            <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

            <Column expander style="width: 3rem" />

            <Column field="name" header="Info Produk" style="min-width: 18rem">
                <template #body="{ data }">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 shrink-0 rounded-lg border border-surface-200 overflow-hidden bg-surface-50 flex items-center justify-center">
                            <img v-if="data.images && data.images.length > 0" :src="data.images[0]" class="w-full h-full object-cover" alt="Product" />
                            <i v-else class="pi pi-image text-surface-300 text-xl"></i>
                        </div>

                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-surface-800 line-clamp-2 leading-tight">{{ data.name }}</div>
                            <div class="text-[10px] text-surface-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span v-if="data.productCode"><i class="pi pi-qrcode text-[9px] mr-0.5"></i>{{ data.productCode }}</span>
                                <span><i class="pi pi-barcode text-[9px] mr-0.5"></i>{{ data.barcode || '-' }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </Column>

            <Column header="Kategori & Merek">
                <template #body="{ data }">
                    <div class="flex flex-col items-start gap-1">
                        <Tag :value="getCategoryName(data.categoryUuid)" severity="secondary" rounded class="!text-[10px]" />
                        <span v-if="data.brand?.name" class="text-[10px] text-surface-500 font-medium">
                            <i class="pi pi-bookmark text-[9px] mr-0.5"></i> {{ data.brand.name }}
                        </span>
                    </div>
                </template>
            </Column>

            <Column header="Satuan">
                <template #body="{ data }">
                    <div class="text-sm font-medium text-surface-700 bg-surface-100 px-2 py-1 rounded inline-block">
                        {{ data.unit?.name || 'Unit' }}
                    </div>
                </template>
            </Column>

            <Column header="Stok">
                <template #body="{ data }">
                    <div v-if="data.isManageStock === false">
                        <Tag value="Non-Fisik/Jasa" severity="contrast" class="!text-[9px]" />
                    </div>
                    <div v-else class="font-bold" :class="(data.stock || 0) > 0 ? 'text-primary-600' : 'text-red-500'">
                        {{ data.stock || 0 }}
                    </div>
                </template>
            </Column>

            <Column header="Lokasi Rak">
                <template #body="{ data }">
                    <div class="text-xs text-surface-600">
                        <i class="pi pi-map-marker text-[10px] mr-1"></i>
                        {{ getShelveNames(data) }}
                    </div>
                </template>
            </Column>

            <Column header="Harga Utama">
                <template #body="{ data }">
                    <div v-if="data.variants && data.variants.length > 0">
                        <Tag value="Multi Harga Varian" severity="info" class="text-[10px]" />
                    </div>
                    <div v-else-if="data.prices && data.prices.length > 0">
                        <span class="font-bold text-surface-800">{{ formatCurrency(getBasePrice(data.prices)) }}</span>
                    </div>
                    <div v-else>
                        <span class="text-xs text-surface-400 italic">Belum diatur</span>
                    </div>
                </template>
            </Column>

            <Column header="Aksi" alignFrozen="right" :exportable="false" style="min-width: 10rem">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button 
                            icon="pi pi-clone" 
                            text 
                            rounded 
                            severity="warning" 
                            @click.stop="openBreakModal(data)" 
                            v-tooltip.top="'Konversi Stok'" 
                        />
                        
                        <Button icon="pi pi-pencil" text rounded severity="info" @click.stop="editProduct(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click.stop="(e) => deleteProduct(e, data)" v-tooltip.top="'Hapus'" />
                    </div>
                </template>
            </Column>

            <template #expansion="{ data }">
                <div class="p-6 bg-surface-50 border border-surface-200 rounded-xl mx-6 my-3 shadow-inner">
                    <div class="flex justify-between items-center mb-4 border-b border-surface-200 pb-3">
                        <h4 class="font-bold text-base text-surface-800 flex items-center gap-2">
                            <i class="pi pi-info-circle text-primary-500"></i> Detail Lengkap Produk
                        </h4>
                        <Tag v-if="data.hasParent" value="Produk Turunan / Konversi" severity="warning" rounded />
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        <div class="col-span-1 lg:col-span-4">
                            <div class="mb-4">
                                <h5 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Foto Produk</h5>
                                <div class="bg-surface-0 border border-surface-200 rounded-lg p-3 shadow-sm">
                                    <div v-if="data.images && data.images.length > 0" class="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                                        <div v-for="(img, idx) in data.images" :key="idx" class="w-20 h-20 shrink-0 border border-surface-200 rounded overflow-hidden">
                                            <img :src="img" class="w-full h-full object-cover" alt="Product View" />
                                        </div>
                                    </div>
                                    <div v-else class="text-center py-6 text-surface-400 flex flex-col items-center">
                                        <i class="pi pi-image text-3xl mb-2 opacity-50"></i>
                                        <span class="text-xs">Belum ada foto</span>
                                    </div>
                                </div>
                            </div>

                            <h5 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Informasi Dasar</h5>
                            <div class="bg-surface-0 border border-surface-200 rounded-lg p-4 shadow-sm space-y-3">
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Nama Produk</div>
                                    <div class="text-sm font-bold text-surface-800">{{ data.name }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Kode Produk</div>
                                    <div class="text-sm font-medium text-surface-800">{{ data.productCode || '-' }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Barcode / SKU</div>
                                    <div class="text-sm font-medium text-surface-800">{{ data.barcode || '-' }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Total Stok Keseluruhan</div>
                                    <div class="text-sm font-bold" :class="(data.stock || 0) > 0 ? 'text-primary-600' : 'text-red-500'">{{ data.stock || 0 }} {{ data.unit?.name || 'Unit' }}</div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <div class="text-[10px] text-surface-500 mb-0.5">Kategori</div>
                                        <div class="text-sm font-medium text-surface-800">{{ getCategoryName(data.categoryUuid) }}</div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] text-surface-500 mb-0.5">Satuan Default</div>
                                        <div class="text-sm font-medium text-surface-800">{{ data.unit?.name || '-' }}</div>
                                    </div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Lokasi Rak</div>
                                    <div class="text-sm font-medium text-surface-800">{{ getShelveNames(data) }}</div>
                                </div>

                                <div class="border-t border-dashed border-surface-200 pt-3 mt-3">
                                    <div class="grid grid-cols-2 gap-2">
                                        <div>
                                            <div class="text-[10px] text-surface-500 mb-0.5">Sistem HPP</div>
                                            <Tag :value="data.hppMethod || 'FIFO'" severity="info" class="!text-[9px]" />
                                        </div>
                                        <div>
                                            <div class="text-[10px] text-surface-500 mb-0.5">PPN Jual (%)</div>
                                            <div class="text-sm font-bold text-orange-600">{{ data.saleTaxPercentage || 0 }} %</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="col-span-1 lg:col-span-8">
                            
                            <div v-if="!data.variants || data.variants.length === 0">
                                <h5 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Daftar Harga & Grosir</h5>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div v-for="price in data.prices" :key="price.uuid" class="bg-surface-0 p-3 rounded-lg border border-surface-200 shadow-sm flex justify-between items-center relative overflow-hidden">
                                        <div class="absolute left-0 top-0 bottom-0 w-1" :class="price.name.toLowerCase().includes('grosir') ? 'bg-orange-400' : 'bg-primary-500'"></div>
                                        <div class="pl-2">
                                            <div class="text-[10px] font-bold uppercase mb-1" :class="price.name.toLowerCase().includes('grosir') ? 'text-orange-600' : 'text-surface-500'">
                                                {{ price.name }}
                                            </div>
                                            <div class="text-sm font-bold text-surface-800">{{ formatCurrency(price.price) }}</div>
                                        </div>
                                        <div v-if="price.minQty > 1 || price.name.toLowerCase().includes('grosir')" class="text-right">
                                            <div class="text-[9px] text-surface-500">Min. Beli</div>
                                            <div class="text-xs font-bold text-surface-700">{{ price.minQty }}</div>
                                        </div>
                                    </div>
                                    <div v-if="!data.prices || data.prices.length === 0" class="col-span-full p-4 border border-dashed border-surface-300 rounded-lg text-center text-sm text-surface-500 bg-surface-0">
                                        Harga belum diatur untuk produk ini.
                                    </div>
                                </div>
                            </div>

                            <div v-else>
                                <div class="flex justify-between items-center mb-3">
                                    <h5 class="text-xs font-bold text-surface-500 uppercase tracking-wider">Varian & Harga Spesifik</h5>
                                    <Tag value="Multi Varian" severity="info" rounded />
                                </div>
                                
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div v-for="variant in data.variants" :key="variant.uuid" class="bg-surface-0 rounded-xl border border-surface-200 shadow-sm overflow-hidden">
                                        <div class="bg-surface-50 p-3 border-b border-surface-100 flex justify-between items-start">
                                            <div>
                                                <div class="font-bold text-sm text-surface-800">{{ variant.name }}</div>
                                                <div class="text-[10px] text-surface-500 mt-0.5"><i class="pi pi-barcode mr-1"></i>{{ variant.barcode || 'Tanpa Barcode' }}</div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-[9px] text-surface-500 uppercase">Stok</div>
                                                <div class="font-bold text-sm" :class="(variant.stock || 0) > 0 ? 'text-primary-600' : 'text-red-500'">{{ variant.stock || 0 }}</div>
                                            </div>
                                        </div>
                                        
                                        <div class="p-3">
                                            <div class="text-[9px] font-bold text-surface-400 uppercase mb-2">Harga Varian:</div>
                                            <div class="flex flex-col gap-2">
                                                <div v-for="vp in variant.prices" :key="vp.uuid" class="flex justify-between items-center pb-2 border-b border-surface-100 last:border-0 last:pb-0">
                                                    <div class="text-[10px] font-semibold" :class="vp.name.toLowerCase().includes('grosir') ? 'text-orange-600' : 'text-surface-600'">
                                                        {{ vp.name }}
                                                    </div>
                                                    <div class="text-right flex items-center gap-3">
                                                        <div v-if="vp.minQty > 1 || vp.name.toLowerCase().includes('grosir')" class="text-[9px] font-medium bg-surface-100 px-1.5 py-0.5 rounded text-surface-600" v-tooltip.top="'Min. Beli'">
                                                            Min: {{ vp.minQty }}
                                                        </div>
                                                        <div class="text-xs font-bold text-surface-800 w-20 text-right">{{ formatCurrency(vp.price) }}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            </template>
        </DataTable>
    </div>

    <ProductBreakModal 
        v-model:visible="showBreakModal" 
        :sourceProduct="selectedProductToBreak"
        @success="handleBreakSuccess"
    />

    <ProductBarcodePrintModal 
            v-model:visible="showBarcodeModal" 
            :selectedProducts="selectedProducts" 
        />
</template>

<style scoped>
/* Scrollbar khusus untuk galeri foto agar rapi */
.custom-scrollbar::-webkit-scrollbar { height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
.custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
</style>