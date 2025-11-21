<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const emit = defineEmits(['create', 'edit']);

const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// State
const products = ref([]);
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- ACTIONS ---
const fetchProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        products.value = (data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            stock: p.stock || [],
            units: p.units || [],
            shelve: p.shelve || [],
            // [BARU] Mapping Kategori dari relasi productCategory
            categories: (p.productCategory || []).map(pc => pc.category?.name).filter(Boolean)
        }));
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
                fetchProducts();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus', life: 3000 });
            }
        }
    });
};

// --- HELPERS ---
const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
const getPricesForUnit = (all, uid) => all.filter(p => p.unitUuid === uid);
const getStockForUnit = (all, uid) => all.find(s => s.unitUuid === uid)?.qty || 0;

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

defineExpose({ refresh: fetchProducts });
</script>

<template>
    <div class="animate-fade-in">
        <div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <div class="relative w-full md:w-96">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                <InputText v-model="filters['global'].value" placeholder="Cari Nama Produk / Barcode..." class="w-full pl-10 !rounded-full shadow-sm" />
            </div>
            <div class="flex gap-2">
                <Button label="Export" icon="pi pi-file-excel" severity="success" text />
                <Button label="Tambah Produk" icon="pi pi-plus" severity="primary" @click="emit('create')" raised rounded />
            </div>
        </div>

        <div class="card bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            <DataTable :value="products" :loading="loading" paginator :rows="10" dataKey="uuid" :filters="filters" stripedRows tableStyle="min-width: 80rem" class="text-sm" :globalFilterFields="['name', 'units.barcode']">
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
                                <div class="font-bold text-base text-surface-800 dark:text-surface-100 leading-tight mb-1">{{ slotProps.data.name }}</div>
                                <div class="text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full inline-block">{{ slotProps.data.units.length }} Varian Satuan</div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Kategori" style="width: 12%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-1.5 py-2">
                            <template v-if="slotProps.data.categories && slotProps.data.categories.length > 0">
                                <span v-for="cat in slotProps.data.categories" :key="cat" 
                                      class="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800 rounded text-[11px] font-medium">
                                    <i class="pi pi-tag text-[9px]"></i>
                                    {{ cat }}
                                </span>
                            </template>
                            <span v-else class="text-xs text-surface-400 italic flex items-center gap-1 mt-1">
                                <i class="pi pi-minus text-[10px]"></i> Non-Kategori
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Lokasi Rak" style="width: 15%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-1.5 py-2">
                            <template v-if="getUniqueShelves(slotProps.data).length > 0">
                                <span v-for="shelfName in getUniqueShelves(slotProps.data)" :key="shelfName" 
                                      class="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800 rounded text-[11px] font-medium">
                                    <i class="pi pi-map-marker text-[9px]"></i>
                                    {{ shelfName }}
                                </span>
                            </template>
                            <span v-else class="text-xs text-surface-400 italic flex items-center gap-1 mt-1">
                                <i class="pi pi-minus-circle text-[10px]"></i> Belum diatur
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Detail Varian (Satuan, Harga, Stok)" style="width: 53%" class="align-top">
                    <template #body="slotProps">
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 py-2">
                            <div v-for="u in slotProps.data.units" :key="u.uuid" class="relative bg-surface-50 dark:bg-surface-800/50 border rounded-lg p-3 flex flex-col gap-2 hover:shadow-md transition-all" :class="u.uuid === slotProps.data.defaultUnitUuid ? 'border-blue-300 ring-1 ring-blue-100' : 'border-surface-200 dark:border-surface-700'">
                                <div v-if="u.uuid === slotProps.data.defaultUnitUuid" class="absolute top-0 right-0"><span class="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg font-bold shadow-sm">DEFAULT</span></div>
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-sm text-surface-800 dark:text-surface-100">{{ u.unitName }}</span>
                                        <span class="text-[10px] text-surface-500 bg-white dark:bg-surface-900 px-1 rounded border border-surface-200">x{{ u.unitMultiplier }}</span>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="text-[10px] text-surface-500 uppercase font-bold">Stok:</span>
                                        <span class="text-sm font-black" :class="getStockForUnit(slotProps.data.stock, u.uuid) > 0 ? 'text-surface-800 dark:text-surface-200' : 'text-red-500'">{{ getStockForUnit(slotProps.data.stock, u.uuid) }}</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-surface-600 bg-white dark:bg-surface-900 p-1.5 rounded border border-dashed border-surface-200 dark:border-surface-700">
                                    <i class="pi pi-barcode text-surface-400"></i>
                                    <span class="font-mono truncate" :title="u.barcode || 'Tanpa Barcode'">{{ u.barcode || 'Tanpa Barcode' }}</span>
                                </div>
                                <div class="space-y-1 pt-1 border-t border-surface-200 dark:border-surface-700">
                                    <div v-for="p in getPricesForUnit(slotProps.data.prices, u.uuid)" :key="p.uuid" class="flex justify-between text-xs">
                                        <span class="text-surface-500">{{ p.name || 'Umum' }}</span>
                                        <span class="font-bold text-primary-600">{{ formatCurrency(p.price) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="" style="width: 10%" class="align-top text-center">
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