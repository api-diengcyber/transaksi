<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import ProductCreateModal from '~/components/ProductCreateModal.vue';
import ShelfCreateModal from '~/components/ShelfCreateModal.vue';

const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const activeMainTab = ref('products'); // 'products' | 'shelves'
const products = ref([]);
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// State untuk Modal Produk
const showModal = ref(false);
const selectedProductUuid = ref(null);

// State untuk Modal Rak (BARU DITAMBAHKAN)
const showShelfModal = ref(false);

// --- ACTIONS ---

const fetchProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        products.value = (data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            stock: p.stock || [],
            units: p.units || []
        }));
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data', life: 3000 });
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
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Produk berhasil dihapus', life: 3000 });
                fetchProducts();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus produk', life: 3000 });
            }
        }
    });
};

const openCreateModal = () => {
    selectedProductUuid.value = null;
    showModal.value = true;
};

const openEditModal = (productData) => {
    selectedProductUuid.value = productData.uuid;
    showModal.value = true;
};

const onProductSaved = () => {
    fetchProducts();
};

// Actions untuk Rak (BARU DITAMBAHKAN)
const openShelfModal = () => {
    showShelfModal.value = true;
};

const onShelfSaved = () => {
    // Disini nanti bisa tambahkan logic fetchShelves() jika sudah ada API-nya
    showShelfModal.value = false;
};

// --- HELPERS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const getPricesForUnit = (allPrices, unitUuid) => {
    return allPrices.filter(p => p.unitUuid === unitUuid);
};

const getStockForUnit = (allStocks, unitUuid) => {
    const stock = allStocks.find(s => s.unitUuid === unitUuid);
    return stock ? stock.qty : 0;
};

onMounted(() => {
    fetchProducts();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="animate-fade-in p-4 min-h-screen bg-surface-50 dark:bg-surface-950">
        <Toast />
        <ConfirmDialog />

        <div class="flex items-center gap-4 mb-6 border-b border-surface-200 dark:border-surface-700 pb-1">
            <button 
                @click="activeMainTab = 'products'"
                class="px-4 py-2 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 outline-none focus:outline-none"
                :class="activeMainTab === 'products' ? 'border-primary-500 text-primary-600 bg-primary-50/50 rounded-t-lg' : 'border-transparent text-surface-500 hover:text-surface-700'"
            >
                <i class="pi pi-box"></i> Master Produk
            </button>
            
            <button 
                @click="activeMainTab = 'shelves'"
                class="px-4 py-2 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2 outline-none focus:outline-none"
                :class="activeMainTab === 'shelves' ? 'border-primary-500 text-primary-600 bg-primary-50/50 rounded-t-lg' : 'border-transparent text-surface-500 hover:text-surface-700'"
            >
                <i class="pi pi-th-large"></i> Lokasi Rak / Shelves
            </button>
        </div>

        <div v-if="activeMainTab === 'products'" class="animate-fade-in">
            
            <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <div class="relative w-full md:w-96">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <InputText v-model="filters['global'].value" placeholder="Cari Nama Produk / Barcode..." class="w-full pl-10 !rounded-full shadow-sm" />
                </div>
                <div class="flex gap-2">
                    <Button label="Export" icon="pi pi-file-excel" severity="success" text />
                    <Button label="Tambah Produk" icon="pi pi-plus" severity="primary" @click="openCreateModal" raised rounded />
                </div>
            </div>

            <div class="card bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                <DataTable 
                    :value="products" 
                    :loading="loading" 
                    paginator :rows="10" 
                    dataKey="uuid" 
                    :filters="filters" 
                    stripedRows
                    tableStyle="min-width: 80rem"
                    class="text-sm"
                    :globalFilterFields="['name', 'units.barcode']"
                >
                    <template #empty>
                        <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                            <i class="pi pi-inbox text-5xl mb-3 opacity-30"></i>
                            <p>Belum ada data produk.</p>
                        </div>
                    </template>

                    <Column field="name" header="Informasi Produk" sortable style="width: 20%" class="align-top">
                        <template #body="slotProps">
                            <div class="flex gap-3 py-2">
                                <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/30 flex items-center justify-center text-blue-600 font-bold text-xl shadow-sm border border-blue-100 shrink-0">
                                    {{ slotProps.data.name.charAt(0).toUpperCase() }}
                                </div>
                                <div>
                                    <div class="font-bold text-base text-surface-800 dark:text-surface-100 leading-tight mb-1">
                                        {{ slotProps.data.name }}
                                    </div>
                                    <div class="text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full inline-block">
                                        {{ slotProps.data.units.length }} Varian Satuan
                                    </div>
                                </div>
                            </div>
                        </template>
                    </Column>

                    <Column header="Detail Varian (Satuan, Harga, Stok)" style="width: 70%" class="align-top">
                        <template #body="slotProps">
                            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 py-2">
                                <div v-for="u in slotProps.data.units" :key="u.uuid" 
                                     class="relative bg-surface-50 dark:bg-surface-800/50 border rounded-lg p-3 flex flex-col gap-2 hover:shadow-md transition-all"
                                     :class="u.uuid === slotProps.data.defaultUnitUuid ? 'border-blue-300 ring-1 ring-blue-100' : 'border-surface-200 dark:border-surface-700'">
                                    
                                    <div v-if="u.uuid === slotProps.data.defaultUnitUuid" class="absolute top-0 right-0">
                                        <span class="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg font-bold shadow-sm">DEFAULT</span>
                                    </div>

                                    <div class="flex justify-between items-center">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-sm text-surface-800 dark:text-surface-100">{{ u.unitName }}</span>
                                            <span class="text-[10px] text-surface-500 bg-white dark:bg-surface-900 px-1 rounded border border-surface-200">x{{ u.unitMultiplier }}</span>
                                        </div>
                                        <div class="flex items-center gap-1">
                                            <span class="text-[10px] text-surface-500 uppercase font-bold">Stok:</span>
                                            <span class="text-sm font-black" 
                                                :class="getStockForUnit(slotProps.data.stock, u.uuid) > 0 ? 'text-surface-800 dark:text-surface-200' : 'text-red-500'">
                                                {{ getStockForUnit(slotProps.data.stock, u.uuid) }}
                                            </span>
                                            <span class="w-2 h-2 rounded-full ml-1" 
                                                :class="getStockForUnit(slotProps.data.stock, u.uuid) > 0 ? 'bg-green-500' : 'bg-red-500'"></span>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2 text-xs text-surface-600 bg-white dark:bg-surface-900 p-1.5 rounded border border-dashed border-surface-200 dark:border-surface-700">
                                        <i class="pi pi-barcode text-surface-400"></i>
                                        <span class="font-mono truncate" :title="u.barcode || 'Tanpa Barcode'">
                                            {{ u.barcode || 'Tanpa Barcode' }}
                                        </span>
                                    </div>

                                    <div class="space-y-1 pt-1 border-t border-surface-200 dark:border-surface-700">
                                        <div v-for="p in getPricesForUnit(slotProps.data.prices, u.uuid)" :key="p.uuid" class="flex justify-between text-xs">
                                            <span class="text-surface-500">{{ p.name || 'Umum' }}</span>
                                            <span class="font-bold text-primary-600">{{ formatCurrency(p.price) }}</span>
                                        </div>
                                        <div v-if="getPricesForUnit(slotProps.data.prices, u.uuid).length === 0" class="text-[10px] text-red-400 italic">Belum set harga</div>
                                    </div>

                                </div>
                            </div>
                        </template>
                    </Column>

                    <Column header="" style="width: 10%" class="align-top text-center">
                        <template #body="slotProps">
                            <div class="flex flex-col gap-2 py-2 justify-center h-full">
                                <Button icon="pi pi-pencil" text rounded severity="info" v-tooltip.left="'Edit'" @click="openEditModal(slotProps.data)" />
                                <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.left="'Hapus'" @click="confirmDelete(slotProps.data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <div v-else-if="activeMainTab === 'shelves'" class="animate-fade-in">
            <div class="flex justify-between items-center mb-4">
                 <h2 class="font-bold text-lg text-surface-700">Manajemen Lokasi Rak</h2>
             </div>

            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div 
                    @click="openShelfModal"
                    class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 flex flex-col items-center justify-center text-center h-48 border-dashed border-2 cursor-pointer hover:bg-surface-50 transition-colors group">
                    <div class="w-12 h-12 rounded-full bg-surface-100 group-hover:bg-primary-50 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-3 transition-colors">
                        <i class="pi pi-plus text-xl"></i>
                    </div>
                    <span class="font-bold text-surface-600 group-hover:text-primary-600">Buat Rak Baru</span>
                </div>

                <div v-for="i in 3" :key="i" class="bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden group hover:shadow-md transition-all">
                    <div class="h-1 bg-gradient-to-r from-blue-400 to-blue-600 w-full"></div>
                    <div class="p-5">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-lg text-surface-800">Rak A-{{ i }}</h3>
                            <Button icon="pi pi-ellipsis-v" text rounded size="small" severity="secondary" />
                        </div>
                        <p class="text-xs text-surface-500 mb-4 flex items-center gap-1">
                            <i class="pi pi-map-marker text-[10px]"></i>
                            Lokasi: Lorong {{ i }}, Depan
                        </p>
                        <div class="flex items-center gap-2 text-sm text-surface-600 bg-surface-50 dark:bg-surface-800 p-2 rounded border border-surface-100 dark:border-surface-700">
                            <i class="pi pi-box text-blue-500"></i>
                            <span><strong>{{ 12 * i }}</strong> Produk tersimpan</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ProductCreateModal 
            v-model:visible="showModal" 
            :productUuid="selectedProductUuid"
            @product-created="onProductSaved" 
            @product-updated="onProductSaved" 
        />

        <ShelfCreateModal 
            v-model:visible="showShelfModal"
            @saved="onShelfSaved"
        />
    </div>
</template>

<style scoped>
/* Adjustment agar isi tabel rata atas */
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    vertical-align: top;
}
.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>