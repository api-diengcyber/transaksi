<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

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

const firstRow = computed(() => (lazyParams.value.page - 1) * lazyParams.value.limit);

// --- FETCH DATA ---
const fetchProducts = async () => {
    loading.value = true;
    try {
        const { page, limit, search } = lazyParams.value;
        const response = await productService.getAllProducts(page, limit, search);

        // [FIX] Handle struktur response API yang bervariasi
        // Kadang response langsung array, kadang dibungkus { data: [...] }
        const rawData = Array.isArray(response) ? response : (response.data || []);
        const meta = response.meta || response.pagination || {};

        // Mapping data agar aman digunakan di template
        products.value = rawData.map(p => ({
            ...p,
            // Pastikan properti array selalu terisi, minimal []
            prices: Array.isArray(p.prices) ? p.prices : (Array.isArray(p.price) ? p.price : []),
            units: Array.isArray(p.units) ? p.units : [],
            shelve: Array.isArray(p.shelve) ? p.shelve : [],
            // Ambil nama kategori
            categoryNames: Array.isArray(p.productCategory) 
                ? p.productCategory.map(pc => pc.category?.name).filter(Boolean) 
                : []
        }));

        // Set Total Records untuk Pagination
        // Jika backend mengirim meta total, pakai itu. Jika tidak, pakai panjang array (untuk client-side pagination)
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
    // [DEBUG] Cek di Console Browser apakah UUID produk benar saat diklik
    console.log("Edit Clicked for:", product.name, "UUID:", product.uuid);
    
    // [FIX] Kirim copy object untuk mencegah referensi reaktif bocor
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
                refresh(); // Reload data
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: err.message || 'Gagal menghapus produk.' });
            }
        }
    });
};

const onPage = (event) => {
    const newPage = Math.floor(event.first / event.rows) + 1;
    lazyParams.value.page = newPage;
    lazyParams.value.limit = event.rows;
    fetchProducts();
};

const onSearch = () => {
    lazyParams.value.page = 1; 
    lazyParams.value.search = searchInput.value;
    fetchProducts();
};

const refresh = () => {
    // Refresh tanpa mereset page (tetap di halaman yang sama) agar UX lebih baik
    fetchProducts();
};

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

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
    <div class="flex flex-col h-full">
        <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-3">
             <div class="relative w-full md:w-96 group">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                <InputText 
                    v-model="searchInput" 
                    placeholder="Cari Nama / Scan Barcode..." 
                    class="w-full pl-10 rounded-full" 
                    @keydown.enter="onSearch"
                />
            </div>

            <div class="flex gap-2 self-end md:self-auto">
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
                />
            </div>
        </div>

        <div class="flex-1 overflow-hidden border border-surface-200 dark:border-surface-700 rounded-xl bg-surface-0 dark:bg-surface-100 shadow-sm flex flex-col">
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
                class="flex-1 p-datatable-sm"
                scrollable 
                scrollHeight="flex"
                :rowsPerPageOptions="[10, 25, 50, 100]"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
                currentPageReportTemplate="{first} - {last} dari {totalRecords}"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-500">
                        <i class="pi pi-box text-4xl mb-2 opacity-50"></i>
                        <p>Tidak ada produk ditemukan.</p>
                    </div>
                </template>

                <template #loading>
                    <div class="flex justify-center py-12">
                        <i class="pi pi-spin pi-spinner text-primary-500 text-3xl"></i>
                    </div>
                </template>

                <Column header="Nama Produk" style="min-width: 250px">
                    <template #body="{ data }">
                        <div class="flex gap-3 items-center py-1">
                            <div class="w-9 h-9 rounded bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center font-bold text-lg shrink-0">
                                {{ data.name.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="font-bold text-sm">{{ data.name }}</div>
                                <div class="flex gap-1 flex-wrap mt-1">
                                    <Tag v-for="cat in data.categoryNames" :key="cat" :value="cat" severity="info" class="!text-[10px] !px-1.5 !py-0.5" />
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Lokasi Rak" style="width: 15%">
                    <template #body="{ data }">
                         <div class="flex flex-wrap gap-1">
                            <Tag v-for="shelf in getUniqueShelves(data)" :key="shelf" icon="pi pi-map-marker" :value="shelf" severity="warning" class="!text-[10px] !bg-orange-50 !text-orange-700 !border-orange-100" />
                            <span v-if="getUniqueShelves(data).length === 0" class="text-xs text-surface-400">-</span>
                        </div>
                    </template>
                </Column>

                <Column header="Satuan & Harga" style="width: 40%">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1.5 py-1">
                            <div 
                                v-for="unit in data.units" 
                                :key="unit.uuid" 
                                class="flex justify-between items-center text-xs border-b border-surface-100 dark:border-surface-800 pb-1 last:border-0"
                            >
                                <div class="flex flex-col">
                                    <div class="flex items-center gap-1">
                                        <span class="font-bold">{{ unit.unitName }}</span>
                                        <span v-if="unit.uuid === data.defaultUnitUuid" class="text-[9px] bg-primary-600 text-white px-1 rounded font-bold">UTAMA</span>
                                    </div>
                                    <span class="text-[10px] text-surface-500">Stok: {{ unit.currentStock || 0 }}</span>
                                </div>
                                
                                <div class="text-right">
                                    <div v-for="price in (data.prices || []).filter(p => p.unitUuid === unit.uuid)" :key="price.uuid" class="flex justify-end gap-1">
                                        <span class="font-mono font-medium">{{ formatCurrency(price.price) }}</span>
                                        <span v-if="price.minWholesaleQty > 0" class="text-[9px] text-green-600 bg-green-50 px-1 rounded border border-green-100">
                                            Min: {{ price.minWholesaleQty }}
                                        </span>
                                    </div>
                                    <span v-if="!(data.prices || []).find(p => p.unitUuid === unit.uuid)" class="text-[10px] text-red-400 italic">Belum ada harga</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column style="width: 100px; text-align: center" frozen alignFrozen="right">
                    <template #body="{ data }">
                        <div class="flex justify-center gap-1">
                            <Button 
                                icon="pi pi-pencil" 
                                severity="secondary" 
                                text 
                                rounded 
                                v-tooltip.top="'Edit'" 
                                @click="handleEdit(data)" 
                                class="hover:bg-blue-50 hover:text-blue-600"
                            />
                            <Button 
                                icon="pi pi-trash" 
                                severity="secondary" 
                                text 
                                rounded 
                                v-tooltip.top="'Hapus'" 
                                @click="confirmDelete(data)" 
                                class="hover:bg-red-50 hover:text-red-600"
                            />
                        </div>
                    </template>
                </Column>

            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Styling Table agar lebih compact */
:deep(.p-datatable-tbody > tr > td) {
    vertical-align: top;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
}
</style>