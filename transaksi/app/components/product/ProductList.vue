<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const emit = defineEmits(['create', 'edit']);

// Pastikan service-service ini di-inject/import dengan benar di project Anda
const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const products = ref([]);
const loading = ref(true);
const totalRecords = ref(0);
const searchInput = ref('');

// Parameter untuk Lazy Loading (Server-side pagination)
const lazyParams = ref({
    page: 1,
    limit: 10, 
    search: null,
});

// Menghitung offset baris pertama untuk paginator PrimeVue
const firstRow = computed(() => (lazyParams.value.page - 1) * lazyParams.value.limit);

// --- ACTIONS ---

const fetchProducts = async () => {
    loading.value = true;
    try {
        const { page, limit, search } = lazyParams.value;

        // Panggil API
        const response = await productService.getAllProducts(page, limit, search);
        
        // Transformasi data agar struktur lebih flat & aman dibaca template
        products.value = (response.data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            shelve: p.shelve || [],
            // Ambil nama kategori saja untuk display
            categoryNames: (p.productCategory || []).map(pc => pc.category?.name).filter(Boolean)
        }));

        // Set total records untuk pagination
        totalRecords.value = response.meta?.total || response.meta?.total_data || 0;
        
        // Sinkronisasi halaman jika API mengembalikan halaman yang berbeda
        if(response.meta?.page) lazyParams.value.page = response.meta.page;

    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const confirmDelete = (prod) => {
    confirm.require({
        message: `Apakah Anda yakin ingin menghapus produk "${prod.name}"? Tindakan ini tidak dapat dibatalkan.`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptIcon: 'pi pi-trash',
        rejectIcon: 'pi pi-times',
        accept: async () => {
            try {
                await productService.deleteProduct(prod.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: `Produk ${prod.name} berhasil dihapus.`, life: 3000 });
                refresh(); // Refresh tabel
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menghapus produk.', life: 3000 });
            }
        }
    });
};

// --- EVENTS ---

const onPage = (event) => {
    const newPage = (event.first / event.rows) + 1;
    const newLimit = event.rows;
    
    if (newPage !== lazyParams.value.page || newLimit !== lazyParams.value.limit) {
        lazyParams.value.page = newPage;
        lazyParams.value.limit = newLimit;
        fetchProducts();
    }
};

const onSearch = () => {
    lazyParams.value.page = 1; // Reset ke halaman 1 saat search
    lazyParams.value.search = searchInput.value;
    fetchProducts();
};

const refresh = () => {
    // Reset pencarian & kembali ke awal
    searchInput.value = '';
    lazyParams.value = { page: 1, limit: 10, search: null };
    fetchProducts();
};

// --- HELPERS ---

const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

// Filter harga berdasarkan unit tertentu
const getPricesForUnit = (allPrices, unitUuid) => {
    if (!allPrices) return [];
    return allPrices.filter(p => p.unitUuid === unitUuid);
};

// Ambil list nama rak unik
const getUniqueShelves = (product) => {
    if (!product.shelve || !Array.isArray(product.shelve)) return [];
    const names = product.shelve.map(ps => ps.shelve?.name).filter(Boolean);    
    return [...new Set(names)];
};

// Warna badge stok
const getStockSeverity = (stock) => {
    if (stock <= 0) return 'danger';    // Merah (Habis)
    if (stock < 10) return 'warning';   // Kuning (Menipis)
    return 'success';                   // Hijau (Aman)
};

onMounted(() => {
    fetchProducts();
});

defineExpose({ refresh });
</script>

<template>
    <div class="animate-fade-in flex flex-col h-full">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
            <div class="relative w-full md:w-96 group">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 transition-colors z-10"></i>
                <InputText 
                    v-model="searchInput" 
                    placeholder="Cari Produk / Scan Barcode..." 
                    class="w-full pl-10 !rounded-full shadow-sm hover:shadow-md focus:shadow-md transition-all border-surface-200 dark:border-surface-700 dark:bg-surface-800"
                    @keydown.enter="onSearch"
                />
            </div>

            <div class="flex gap-2 self-end md:self-auto">
                <Button 
                    label="Refresh" 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    text 
                    rounded 
                    @click="refresh" 
                    v-tooltip.bottom="'Muat ulang data'"
                />
                <Button 
                    label="Produk Baru" 
                    icon="pi pi-plus" 
                    severity="primary" 
                    rounded 
                    raised
                    @click="emit('create')" 
                />
            </div>
        </div>

        <div class="card bg-surface-0 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden flex-1 flex flex-col">
             
             <DataTable 
                :value="products" 
                :loading="loading" 
                :lazy="true"  
                paginator 
                :rows="lazyParams.limit"
                :totalRecords="totalRecords" 
                :first="firstRow" 
                @page="onPage" 
                dataKey="uuid" 
                stripedRows 
                tableStyle="min-width: 80rem" 
                class="text-sm flex-1"
                :rowsPerPageOptions="[5, 10, 25, 50]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                currentPageReportTemplate="{first} - {last} dari {totalRecords}"
             >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-surface-400 dark:text-surface-500">
                        <div class="bg-surface-50 dark:bg-surface-800 p-6 rounded-full mb-4">
                            <i class="pi pi-box text-4xl opacity-50"></i>
                        </div>
                        <h3 class="font-semibold text-lg mb-1">Tidak ada produk ditemukan</h3>
                        <p class="text-sm opacity-80">Coba kata kunci lain atau tambahkan produk baru.</p>
                        <Button label="Buat Produk Baru" icon="pi pi-plus" text class="mt-4" @click="emit('create')" />
                    </div>
                </template>

                <template #loading>
                    <div class="py-12 flex justify-center">
                        <i class="pi pi-spin pi-spinner text-4xl text-primary-500"></i>
                    </div>
                </template>

                <Column header="Produk" style="width: 25%" class="align-top">
                    <template #body="{ data }">
                        <div class="flex gap-3 py-2">
                            <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800 flex items-center justify-center font-bold text-lg shrink-0 select-none">
                                {{ data.name.charAt(0).toUpperCase() }}
                            </div>
                            
                            <div class="flex flex-col gap-1">
                                <span class="font-bold text-surface-800 dark:text-surface-100 text-[15px] leading-snug">
                                    {{ data.name }}
                                </span>
                                
                                <div class="flex flex-wrap gap-1">
                                    <template v-if="data.categoryNames.length">
                                        <Tag v-for="cat in data.categoryNames" :key="cat" :value="cat" severity="info" class="!text-[10px] !px-1.5 !py-0.5 !font-medium bg-blue-50 text-blue-700 border border-blue-100" />
                                    </template>
                                    <span v-else class="text-xs text-surface-400 italic">Tanpa Kategori</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Lokasi Rak" style="width: 15%" class="align-top">
                    <template #body="{ data }">
                         <div class="flex flex-wrap gap-1.5 py-2">
                            <template v-if="getUniqueShelves(data).length > 0">
                                <Tag v-for="shelf in getUniqueShelves(data)" :key="shelf" icon="pi pi-map-marker" :value="shelf" severity="warning" class="!text-[10px] !bg-orange-50 !text-orange-700 !border-orange-100" />
                            </template>
                            <span v-else class="text-xs text-surface-400 flex items-center gap-1 opacity-70">
                                <i class="pi pi-minus-circle"></i> -
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Daftar Satuan & Harga" style="width: 50%" class="align-top">
                    <template #body="{ data }">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 py-1">
                            <div 
                                v-for="unit in data.units" 
                                :key="unit.uuid" 
                                class="relative bg-surface-0 dark:bg-surface-800 border rounded-xl p-3 hover:shadow-md transition-all group"
                                :class="unit.uuid === data.defaultUnitUuid ? 'border-primary-300 ring-1 ring-primary-100 dark:ring-primary-900/50' : 'border-surface-200 dark:border-surface-700'"
                            >
                                <div v-if="unit.uuid === data.defaultUnitUuid" class="absolute -top-2 -right-1">
                                    <span class="bg-primary-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm uppercase tracking-wider">Utama</span>
                                </div>

                                <div class="flex justify-between items-start mb-2 border-b border-surface-100 dark:border-surface-700 pb-2">
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-1.5">
                                            <span class="font-bold text-sm text-surface-800 dark:text-surface-100">{{ unit.unitName }}</span>
                                            <span class="text-[10px] text-surface-500 bg-surface-100 dark:bg-surface-700 px-1.5 rounded border border-surface-200 dark:border-surface-600">x{{ unit.unitMultiplier }}</span>
                                        </div>
                                        <div class="flex items-center gap-1 mt-0.5 text-[11px] text-surface-500 font-mono">
                                            <i class="pi pi-barcode text-[9px]"></i>
                                            <span>{{ unit.barcode || '-' }}</span>
                                        </div>
                                    </div>
                                    
                                    <div class="text-right">
                                        <Tag :value="unit.currentStock || 0" :severity="getStockSeverity(unit.currentStock)" class="!text-[11px] !font-black !px-2" />
                                        <div class="text-[9px] text-surface-400 mt-0.5">Stok Saat Ini</div>
                                    </div>
                                </div>

                                <div class="space-y-1.5">
                                    <div v-for="price in getPricesForUnit(data.prices, unit.uuid)" :key="price.uuid" class="flex justify-between items-center text-xs">
                                        <div class="flex items-center gap-1.5">
                                            <span class="text-surface-600 dark:text-surface-300 font-medium">{{ price.name || 'Umum' }}</span>
                                            <span v-if="price.minWholesaleQty > 0" class="text-[9px] text-green-600 bg-green-50 px-1 rounded border border-green-100" v-tooltip.top="'Minimal pembelian grosir'">
                                                Min: {{ price.minWholesaleQty }}
                                            </span>
                                        </div>
                                        <span class="font-bold text-surface-900 dark:text-surface-100 font-mono">{{ formatCurrency(price.price) }}</span>
                                    </div>
                                    <div v-if="getPricesForUnit(data.prices, unit.uuid).length === 0" class="text-[10px] text-red-400 italic">
                                        Harga belum diatur
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column style="width: 10%" class="align-top">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-2 py-2 items-center">
                            <Button 
                                icon="pi pi-pencil" 
                                severity="secondary" 
                                text 
                                rounded 
                                size="small"
                                v-tooltip.left="'Edit Produk'" 
                                @click="emit('edit', data)" 
                                class="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
                            />
                            <Button 
                                icon="pi pi-trash" 
                                severity="secondary" 
                                text 
                                rounded 
                                size="small"
                                v-tooltip.left="'Hapus Produk'" 
                                @click="confirmDelete(data)" 
                                class="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                            />
                        </div>
                    </template>
                </Column>

             </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Styling Custom untuk DataTable agar lebih bersih */
:deep(.p-datatable) {
    background: transparent !important;
}

/* Header Tabel */
:deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-50) !important;
    color: var(--p-surface-600) !important;
    font-weight: 700 !important;
    font-size: 0.75rem !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--p-surface-200) !important;
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
}

/* Dark Mode Header */
.dark :deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-900) !important;
    color: var(--p-surface-400) !important;
    border-bottom-color: var(--p-surface-800) !important;
}

/* Body Cell Alignment */
:deep(.p-datatable-tbody > tr > td) {
    vertical-align: top;
    padding-top: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--p-surface-100);
}
.dark :deep(.p-datatable-tbody > tr > td) {
    border-bottom-color: var(--p-surface-800);
}

/* Row Hover Effect */
:deep(.p-datatable-tbody > tr) {
    transition: background-color 0.2s;
}
:deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-50) !important;
}
.dark :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-800) !important;
}

/* Animasi Masuk */
.animate-fade-in {
    animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>