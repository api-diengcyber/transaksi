<script setup>
import { ref, onMounted, computed } from 'vue'; // Pastikan 'computed' di-import
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const emit = defineEmits(['create', 'edit']);

// Pastikan useProductService, useToast, dan useConfirm tersedia di konteks ini
const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE UNTUK LAZY LOADING & SEARCH ---
const products = ref([]);
const loading = ref(true);
const totalRecords = ref(0);
const searchInput = ref(''); // Input teks pencarian

// Parameter state untuk API call (page, limit, search term)
const lazyParams = ref({
    page: 1,
    limit: 10, 
    search: null,
});
// --- END STATE ---

// HITUNG OFFSET (INDEX BARIS PERTAMA)
// Ini adalah properti PENTING yang memberitahu PrimeVue di halaman mana kita berada.
const firstRow = computed(() => (lazyParams.value.page - 1) * lazyParams.value.limit);

// --- ACTIONS ---
const fetchProducts = async () => {
    loading.value = true;
    try {
        const { page, limit, search } = lazyParams.value;

        // Memanggil API dengan parameter pagination dan search
        const response = await productService.getAllProducts(page, limit, search);
        
        products.value = (response.data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            shelve: p.shelve || [],
            // Mapping Kategori dari relasi productCategory
            categories: (p.productCategory || []).map(pc => pc.category?.name).filter(Boolean)
        }));

        console.log('Fetched Products:', products.value);

        // Mengambil metadata dari respons backend
        // *** PASTIKAN response.meta.total memiliki nilai > 10 agar paginasi muncul ***
        totalRecords.value = response.meta.total;
        lazyParams.value.page = response.meta.page; // Update halaman dari meta response

    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data produk', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const confirmDelete = (prod) => {
    confirm.require({
        message: `Hapus produk ${prod.name}?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await productService.deleteProduct(prod.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Produk dihapus', life: 3000 });
                // Setelah delete, panggil ulang data
                refresh(); 
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus', life: 3000 });
            }
        }
    });
};

// --- HANDLER PAGINASI (DIPANGGIL OLEH DATATABLE) ---
const onPage = (event) => {
    // event.first adalah offset (index baris pertama), event.rows adalah limit
    const newPage = (event.first / event.rows) + 1; 
    const newLimit = event.rows;
    
    if (newPage !== lazyParams.value.page || newLimit !== lazyParams.value.limit) {
        lazyParams.value.page = newPage;
        lazyParams.value.limit = newLimit;
        fetchProducts();
    }
};

// --- HANDLER PENCARIAN (DIPANGGIL OLEH TOMBOL/ENTER) ---
const onSearch = () => {
    // Reset halaman ke 1 ketika melakukan pencarian baru
    lazyParams.value.page = 1;
    lazyParams.value.search = searchInput.value;
    fetchProducts();
}

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
const getPricesForUnit = (all, uid) => all.filter(p => p.unitUuid === uid);
const getCurrentStock = (unit) => {
    return unit.currentStock || 0; 
};
const getUniqueShelves = (product) => {
    if (!product.shelve || !Array.isArray(product.shelve)) return [];
    const names = product.shelve
        .map(ps => ps.shelve?.name)
        .filter(name => !!name);    
    return [...new Set(names)];
};

onMounted(() => {
    fetchProducts();
});

const refresh = () => {
    // Reset semua state saat refresh dipanggil dari luar
    searchInput.value = '';
    lazyParams.value.page = 1;
    lazyParams.value.search = null;
    lazyParams.value.limit = 10;
    fetchProducts();
};

defineExpose({ refresh });
</script>

---

<template>
    <div class="animate-fade-in">
        <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <div class="relative flex gap-2 w-full md:w-96">
                <InputText 
                    v-model="searchInput" 
                    placeholder="Cari Nama Produk / Barcode..." 
                    class="w-full pl-3 !rounded-full shadow-sm"
                    @keydown.enter="onSearch"
                />
                <Button 
                    icon="pi pi-search" 
                    @click="onSearch" 
                    severity="secondary" 
                    rounded
                    aria-label="Cari"
                />
            </div>
            <div class="flex gap-2">
                <Button label="Export" icon="pi pi-file-excel" severity="success" text />
                <Button label="Tambah Produk" icon="pi pi-plus" severity="primary" @click="emit('create')" raised rounded />
            </div>
        </div>

        <div class="card bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
             
             <DataTable 
                :value="products" 
                :loading="loading" 
                :lazy="true"  
                paginator 
                :rows="lazyParams.limit"
                :totalRecords="totalRecords" 
                :first="firstRow" @page="onPage" 
                dataKey="uuid" 
                stripedRows 
                tableStyle="min-width: 90rem" 
                class="text-sm datatable-dark-safe dark:text-surface-100" 
                :rowsPerPageOptions="[10, 25, 50]"
                currentPageReportTemplate="Menampilkan {first} hingga {last} dari {totalRecords} produk"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
             >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400 dark:text-surface-600">
                        <i class="pi pi-inbox text-5xl mb-3 opacity-30"></i>
                        <p>Belum ada data produk.</p>
                    </div>
                </template>

                <Column field="name" header="Informasi Produk" sortable style="width: 18%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex gap-3 py-2">
                            <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/30 flex items-center justify-center text-blue-600 font-bold text-xl shadow-sm border border-blue-100 dark:border-blue-800 shrink-0">
                                {{ slotProps.data.name.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="font-bold text-base text-surface-800 dark:text-surface-100 leading-tight mb-1">{{ slotProps.data.name }}</div>
                                <div class="text-xs text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full inline-block">{{ slotProps.data.units.length }} Varian Satuan</div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Kategori" style="width: 10%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-1.5 py-2">
                            <template v-if="slotProps.data.categories && slotProps.data.categories.length > 0">
                                <span v-for="cat in slotProps.data.categories" :key="cat" 
                                        class="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800 rounded text-[11px] font-medium">
                                    <i class="pi pi-tag text-[9px]"></i>
                                    {{ cat }}
                                </span>
                            </template>
                            <span v-else class="text-xs text-surface-400 dark:text-surface-600 italic flex items-center gap-1 mt-1">
                                <i class="pi pi-minus text-[10px]"></i> Non-Kategori
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Lokasi Rak" style="width: 12%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-1.5 py-2">
                            <template v-if="getUniqueShelves(slotProps.data).length > 0">
                                <span v-for="shelfName in getUniqueShelves(slotProps.data)" :key="shelfName" 
                                        class="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800 rounded text-[11px] font-medium">
                                    <i class="pi pi-map-marker text-[9px]"></i>
                                    {{ shelfName }}
                                </span>
                            </template>
                            <span v-else class="text-xs text-surface-400 dark:text-surface-600 italic flex items-center gap-1 mt-1">
                                <i class="pi pi-minus-circle text-[10px]"></i> Belum diatur
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Detail Varian (Satuan, Harga, Stok)" style="width: 50%" class="align-top">
                    <template #body="slotProps">
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 py-2">
                            <div v-for="u in slotProps.data.units" :key="u.uuid" 
                                 class="relative bg-surface-50 dark:bg-surface-800/50 border rounded-lg p-3 flex flex-col gap-2 hover:shadow-md transition-all" 
                                 :class="u.uuid === slotProps.data.defaultUnitUuid 
                                    ? 'border-blue-300 ring-1 ring-blue-100 dark:ring-blue-900' 
                                    : 'border-surface-200 dark:border-surface-700'">
                                
                                <div v-if="u.uuid === slotProps.data.defaultUnitUuid" class="absolute top-0 right-0">
                                    <span class="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg font-bold shadow-sm dark:bg-blue-800">DEFAULT</span>
                                </div>
                                
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-sm text-surface-800 dark:text-surface-100">{{ u.unitName }}</span>
                                        <span class="text-[10px] text-surface-500 dark:text-surface-400 bg-white dark:bg-surface-900 px-1 rounded border border-surface-200 dark:border-surface-700">x{{ u.unitMultiplier }}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="text-[10px] text-surface-500 dark:text-surface-400 uppercase font-bold">Stok:</span>
                                        <span class="text-sm font-black" :class="getCurrentStock(u) > 0 ? 'text-surface-800 dark:text-surface-200' : 'text-red-500 dark:text-red-400'">
                                            {{ getCurrentStock(u) }}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-900 p-1.5 rounded border border-dashed border-surface-200 dark:border-surface-700">
                                    <i class="pi pi-barcode text-surface-400 dark:text-surface-500"></i>
                                    <span class="font-mono truncate" :title="u.barcode || 'Tanpa Barcode'">{{ u.barcode || 'Tanpa Barcode' }}</span>
                                </div>
                                
                                <div class="space-y-1 pt-1 border-t border-surface-200 dark:border-surface-700">
                                    <div v-for="p in getPricesForUnit(slotProps.data.prices, u.uuid)" :key="p.uuid" class="flex flex-col border-b last:border-b-0 border-surface-100 dark:border-surface-800 pb-1 pt-0.5">
                                        
                                        <div class="flex justify-between text-xs items-center">
                                            <span class="text-surface-600 dark:text-surface-300 font-semibold">{{ p.name || 'Umum' }}</span>
                                            <span class="font-bold text-primary-600 dark:text-primary-400 text-sm">{{ formatCurrency(p.price) }}</span>
                                        </div>

                                        <div v-if="p.minWholesaleQty > 0" class="flex justify-between text-[10px] text-green-600 dark:text-green-400 items-center">
                                            <span class="font-medium flex items-center gap-1">
                                                <i class="pi pi-box"></i> Min. Grosir:
                                            </span>
                                            <span class="font-bold">
                                                {{ p.minWholesaleQty }} {{ u.unitName }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="" style="width: 10%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-col gap-2 py-2 justify-center h-full">
                            <Button icon="pi pi-pencil" text rounded severity="info" v-tooltip.left="'Edit'" @click="emit('edit', slotProps.data)" />
                            <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.left="'Hapus'" @click="confirmDelete(slotProps.data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
             </div>
    </div>
</template>

---

<style scoped>
/* Mengatasi latar belakang tabel utama */
:deep(.p-datatable) {
    /* Menjadikan latar belakang transparent dan menghapus latar belakang PrimeVue */
    background: transparent !important;
    border-color: transparent !important;
}

/* Mengatasi latar belakang header */
:deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-50) !important; /* Light Mode default */
    color: var(--p-text-color) !important;
    border-color: var(--p-surface-200) !important;
}

/* Memaksa warna header di Dark Mode */
.dark :deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-900) !important;
    color: var(--p-surface-100) !important;
    border-color: var(--p-surface-800) !important;
}

/* Mengatasi latar belakang baris */
:deep(.p-datatable-tbody > tr) {
    background-color: var(--p-surface-0) !important; /* Light Mode default (putih) */
    color: var(--p-text-color) !important;
    border-color: var(--p-surface-200) !important;
}

/* Mengatasi warna baris ganjil/genap (striped rows) */
:deep(.p-datatable-tbody .p-row-even) {
    background-color: var(--p-surface-50) !important; /* Light Mode striped */
}

/* Memaksa warna baris di Dark Mode */
.dark :deep(.p-datatable-tbody > tr) {
    background-color: var(--p-surface-900) !important; /* Default Dark Row */
}
.dark :deep(.p-datatable-tbody .p-row-even) {
    background-color: var(--p-surface-950) !important; /* Striped Dark Row (Genap) */
}
/* Memastikan warna baris ganjil di Dark Mode juga benar */
.dark :deep(.p-datatable-tbody .p-row-odd) {
     background-color: var(--p-surface-900) !important; /* Striped Dark Row (Ganjil) */
}

/* HOVER ROW FIX */
.dark :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-800) !important; 
}
:deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-100) !important; 
}

/* Penyesuaian agar isi tabel rata atas */
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    vertical-align: top;
    border-color: var(--p-surface-200); /* Border Light */
}
.dark :deep(.p-datatable .p-datatable-tbody > tr > td) {
    border-color: var(--p-surface-800); /* Border Dark */
}


.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>