<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import ProductBreakModal from './ProductBreakModal.vue';

const emit = defineEmits(['create', 'edit']);

// Inject Service
const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const products = ref([]);
const loading = ref(true);
const totalRecords = ref(0);
const searchInput = ref('');

// Parameter Pagination
const lazyParams = ref({
    page: 1,
    limit: 10,
    search: '',
});

// State untuk Break Modal
const showBreakModal = ref(false);
const selectedProductForBreak = ref(null);

const firstRow = computed(() => (lazyParams.value.page - 1) * lazyParams.value.limit);

// --- FETCH DATA ---
const fetchProducts = async () => {
    loading.value = true;
    try {
        const { page, limit, search } = lazyParams.value;
        const response = await productService.getAllProducts(page, limit, search);

        const rawData = Array.isArray(response) ? response : (response.data || []);
        const meta = response.meta || response.pagination || {};

        products.value = rawData.map(p => ({
            ...p,
            prices: Array.isArray(p.prices) ? p.prices : (Array.isArray(p.price) ? p.price : []),
            units: Array.isArray(p.units) ? p.units : [],
            shelve: Array.isArray(p.shelve) ? p.shelve : [],
            // Helper untuk status stok total
            totalStock: (Array.isArray(p.units) ? p.units : []).reduce((acc, curr) => acc + (Number(curr.currentStock) || 0), 0),
            categoryNames: Array.isArray(p.productCategory) 
                ? p.productCategory.map(pc => pc.category?.name).filter(Boolean) 
                : []
        }));

        if (meta.total || meta.total_data) {
            totalRecords.value = meta.total || meta.total_data;
        } else {
            totalRecords.value = products.value.length;
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.' });
        products.value = [];
    } finally {
        loading.value = false;
    }
};

// --- HANDLERS ---
const handleEdit = (product) => {
    emit('edit', { ...product });
};

const confirmDelete = (prod) => {
    confirm.require({
        message: `Hapus produk "${prod.name}"? Data tidak dapat dikembalikan.`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await productService.deleteProduct(prod.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Produk berhasil dihapus.' });
                refresh();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menghapus produk.' });
            }
        }
    });
};

const onPage = (event) => {
    lazyParams.value.page = event.page + 1;
    lazyParams.value.limit = event.rows;
    fetchProducts();
};

const onSearch = () => {
    lazyParams.value.page = 1; 
    lazyParams.value.search = searchInput.value;
    fetchProducts();
};

const refresh = () => {
    fetchProducts();
};

// --- BREAK UNIT HANDLERS ---
const openBreakModal = (product) => {
    // Validasi sederhana: minimal punya 2 satuan (misal BOX dan PCS)
    const hasMultipleUnits = product.units && product.units.length > 1;
    if (!hasMultipleUnits) {
        toast.add({ severity: 'info', summary: 'Info', detail: 'Produk ini hanya memiliki 1 satuan, tidak bisa dipecah.' });
        return;
    }
    selectedProductForBreak.value = product;
    showBreakModal.value = true;
};

const onBreakSuccess = () => {
    refresh(); // Refresh data tabel untuk melihat update stok
};

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

const getStockSeverity = (stock) => {
    if (stock <= 0) return 'danger';
    if (stock < 10) return 'warning';
    return 'success';
};

const getUniqueShelves = (product) => {
    if (!product.shelve || !Array.isArray(product.shelve)) return [];
    return [...new Set(product.shelve.map(ps => ps.shelve?.name).filter(Boolean))];
};

onMounted(() => {
    fetchProducts();
});

defineExpose({ refresh });
</script>

<template>
    <div class="flex flex-col h-full gap-4">
        <div class="flex flex-col md:flex-row justify-between items-center gap-3 bg-surface-0  p-3 rounded-xl border border-surface-200  shadow-sm">
             <div class="relative w-full md:w-96 group">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 transition-colors"></i>
                <InputText 
                    v-model="searchInput" 
                    placeholder="Cari Nama / Scan Barcode..." 
                    class="w-full pl-10 rounded-full !bg-surface-50  focus:!bg-surface-0 transition-all border-none ring-1 ring-surface-200 focus:ring-primary-500" 
                    @keydown.enter="onSearch"
                />
            </div>

            <div class="flex gap-2 w-full md:w-auto">
                <Button 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    text 
                    rounded 
                    @click="refresh" 
                    v-tooltip="'Refresh Data'"
                />
                <Button 
                    label="Produk Baru" 
                    icon="pi pi-plus" 
                    severity="primary" 
                    rounded 
                    @click="emit('create')" 
                    class="w-full md:w-auto shadow-lg shadow-primary-500/20"
                />
            </div>
        </div>

        <div class="flex-1 overflow-hidden border border-surface-200  rounded-xl bg-surface-0  shadow-sm flex flex-col">
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
                class="flex-1 p-datatable-sm bg-surface-0"
                scrollable 
                scrollHeight="flex"
                :rowsPerPageOptions="[10, 25, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                currentPageReportTemplate="{first} - {last} dari {totalRecords}"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-surface-500">
                        <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                            <i class="pi pi-box text-3xl opacity-50"></i>
                        </div>
                        <p class="font-medium">Tidak ada produk ditemukan.</p>
                        <p class="text-sm opacity-70">Coba kata kunci lain atau buat produk baru.</p>
                    </div>
                </template>

                <template #loading>
                    <div class="p-4 space-y-3">
                        <Skeleton height="4rem" v-for="i in 5" :key="i" class="!rounded-lg" />
                    </div>
                </template>

                <Column header="Produk" style="min-width: 280px" frozen>
                    <template #body="{ data }">
                        <div class="flex gap-3 items-start py-1">
                            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600  flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">
                                {{ data.name.charAt(0).toUpperCase() }}
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="font-bold text-sm  leading-tight">{{ data.name }}</span>
                                <div class="flex gap-1 flex-wrap">
                                    <Badge v-for="cat in data.categoryNames" :key="cat" :value="cat" severity="secondary" class="!text-[10px] !font-normal" />
                                    <span v-if="data.categoryNames.length === 0" class="text-[10px] text-surface-400 italic">Tanpa Kategori</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Satuan & Stok" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div 
                                v-for="unit in data.units" 
                                :key="unit.uuid" 
                                class="flex justify-between items-center text-xs p-1 hover:bg-surface-50  rounded transition-colors"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="font-medium min-w-[30px]">{{ unit.unitName }}</span>
                                    <Badge 
                                        :value="unit.currentStock || 0" 
                                        :severity="getStockSeverity(unit.currentStock)" 
                                        class="!min-w-[1.5rem] !h-[1.25rem] !text-[10px]"
                                    />
                                    <i v-if="unit.uuid === data.defaultUnitUuid" class="pi pi-star-fill text-yellow-500 text-[9px]" v-tooltip="'Satuan Utama'"></i>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Lokasi" style="min-width: 150px">
                    <template #body="{ data }">
                         <div class="flex flex-wrap gap-1">
                            <div v-for="shelf in getUniqueShelves(data)" :key="shelf" class="flex items-center gap-1 bg-orange-50 text-orange-700  px-2 py-0.5 rounded text-[11px] border border-orange-100 /30">
                                <i class="pi pi-map-marker text-[9px]"></i>
                                <span>{{ shelf }}</span>
                            </div>
                            <span v-if="getUniqueShelves(data).length === 0" class="text-xs text-surface-400">-</span>
                        </div>
                    </template>
                </Column>

                <Column header="Daftar Harga" style="min-width: 220px">
                    <template #body="{ data }">
                         <div class="flex flex-col gap-1 py-1">
                            <div v-for="unit in data.units" :key="unit.uuid + '_price'" class="text-xs">
                                <div v-for="price in (data.prices || []).filter(p => p.unitUuid === unit.uuid)" :key="price.uuid" class="flex justify-between items-center border-b border-dashed border-surface-200  last:border-0 py-0.5">
                                    <span class="text-surface-500 text-[10px] w-12">{{ unit.unitName }}</span>
                                    <div class="flex flex-col items-end">
                                        <span class="font-mono font-medium">{{ formatCurrency(price.price) }}</span>
                                        <span v-if="price.minWholesaleQty > 0" class="text-[9px] text-green-600 bg-green-50 px-1 rounded">
                                            Grosir ≥ {{ price.minWholesaleQty }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 120px; text-align: center" frozen alignFrozen="right">
                    <template #body="{ data }">
                        <div class="flex justify-center gap-1">
                            <Button 
                                icon="pi pi-pencil" 
                                outlined
                                rounded 
                                severity="info"
                                size="small"
                                v-tooltip.top="'Edit'" 
                                @click="handleEdit(data)" 
                                class="!w-8 !h-8"
                            />
                            
                            <Button 
                                v-if="data.units && data.units.length > 1"
                                icon="pi pi-box" 
                                outlined 
                                rounded 
                                severity="help" 
                                size="small"
                                v-tooltip.top="'Pecah Satuan'"
                                @click="openBreakModal(data)" 
                                class="!w-8 !h-8"
                            />

                            <Button 
                                icon="pi pi-trash" 
                                outlined
                                rounded 
                                severity="danger" 
                                size="small"
                                v-tooltip.top="'Hapus'" 
                                @click="confirmDelete(data)" 
                                class="!w-8 !h-8"
                            />
                        </div>
                    </template>
                </Column>

            </DataTable>
        </div>

        <ProductBreakModal 
            v-model:visible="showBreakModal"
            :product="selectedProductForBreak"
            @saved="onBreakSuccess"
        />
    </div>
</template>

<style scoped>
:deep(.p-datatable-tbody > tr > td) {
    vertical-align: top;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
}
</style>