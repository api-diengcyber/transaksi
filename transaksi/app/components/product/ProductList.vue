<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

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

// --- FETCH DATA ---
const fetchCategories = async () => {
    try {
        const res = await categoryService.getAllCategories();
        const raw = res?.value !== undefined ? res.value : res;
        categories.value = raw?.data?.data || raw?.data || raw || [];
    } catch (error) {
        console.error("Gagal load kategori:", error);
    }
};

const fetchShelves = async () => {
    try {
        const res = await shelveService.getAllShelves();
        const raw = res?.value !== undefined ? res.value : res;
        shelves.value = raw?.data?.data || raw?.data || raw || [];
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
        
        const raw = res?.value !== undefined ? res.value : res;
        products.value = raw?.data?.data || raw?.data || raw || [];
        totalRecords.value = raw?.meta?.totalItems || raw?.data?.meta?.totalItems || products.value.length || 0;
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

// Helper untuk menampilkan nama-nama rak
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

// Menghitung Total Stok (termasuk varian jika ada)
const getTotalStock = (product) => {
    if (product.variants && product.variants.length > 0) {
        return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }
    return Number(product.stock) || 0;
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

const deleteProduct = (product) => {
    confirm.require({
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
                <Button label="Tambah Produk" icon="pi pi-plus" @click="emit('create')" class="whitespace-nowrap" />
            </div>
        </div>

        <DataTable 
            v-model:expandedRows="expandedRows" 
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

            <Column expander style="width: 3rem" />

            <Column field="name" header="Info Produk" style="min-width: 15rem">
                <template #body="{ data }">
                    <div>
                        <div class="font-bold text-surface-800">{{ data.name }}</div>
                        <div class="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
                            <span><i class="pi pi-barcode text-[10px]"></i> {{ data.barcode || '-' }}</span>
                        </div>
                    </div>
                </template>
            </Column>

            <Column header="Kategori">
                <template #body="{ data }">
                    <Tag :value="getCategoryName(data.categoryUuid)" severity="secondary" rounded />
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

            <Column header="Stok Total">
                <template #body="{ data }">
                    <div class="font-bold" :class="getTotalStock(data) > 0 ? 'text-primary-600' : 'text-red-500'">
                        {{ getTotalStock(data) }} <span class="text-xs font-normal text-surface-500">{{ data.unit?.name || 'Unit' }}</span>
                    </div>
                </template>
            </Column>

            <Column header="Harga Utama">
                <template #body="{ data }">
                    <div v-if="data.variants && data.variants.length > 0">
                        <Tag value="Multi Harga Varian" severity="info" class="text-[10px]" />
                    </div>
                    <div v-else-if="data.prices && data.prices.length > 0">
                        <span class="font-bold text-surface-800">{{ formatCurrency(data.prices[0].price) }}</span>
                    </div>
                    <div v-else>
                        <span class="text-xs text-surface-400 italic">Belum diatur</span>
                    </div>
                </template>
            </Column>

            <Column header="Aksi" alignFrozen="right" :exportable="false" style="min-width: 8rem">
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" text rounded severity="info" @click="editProduct(data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="deleteProduct(data)" v-tooltip.top="'Hapus'" />
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
                            <h5 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">Informasi Dasar</h5>
                            <div class="bg-surface-0 border border-surface-200 rounded-lg p-4 shadow-sm space-y-3">
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Nama Produk</div>
                                    <div class="text-sm font-bold text-surface-800">{{ data.name }}</div>
                                </div>
                                <div>
                                    <div class="text-[10px] text-surface-500 mb-0.5">Barcode / SKU</div>
                                    <div class="text-sm font-medium text-surface-800">{{ data.barcode || '-' }}</div>
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
                                                <div class="font-bold text-sm" :class="variant.stock > 0 ? 'text-primary-600' : 'text-red-500'">{{ variant.stock || 0 }}</div>
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
</template>