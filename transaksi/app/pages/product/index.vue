<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import ProductCreateModal from '~/components/ProductCreateModal.vue';

const productService = useProductService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const products = ref([]);
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const showModal = ref(false);
const selectedProductUuid = ref(null);

// --- ACTIONS ---

const fetchProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        // Normalisasi Data
        products.value = (data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            stock: p.stock || []
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

// --- MODAL HANDLERS ---
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

// --- HELPERS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

onMounted(() => {
    fetchProducts();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="card animate-fade-in p-4">
        <Toast />
        <ConfirmDialog />

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-0 tracking-tight">Manajemen Produk</h1>
                <p class="text-surface-500 mt-1">Kelola katalog, barcode satuan, dan harga jual.</p>
            </div>
            <div class="flex gap-2">
                 <Button label="Export" icon="pi pi-download" severity="secondary" outlined />
                 <Button label="Produk Baru" icon="pi pi-plus" severity="primary" @click="openCreateModal" raised />
            </div>
        </div>

        <div class="card bg-surface-0 dark:bg-surface-900 p-0 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            
            <div class="flex justify-between items-center p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50">
                <span class="p-input-icon-left w-full sm:w-72">
                    <i class="pi pi-search text-surface-400" />
                    <InputText v-model="filters['global'].value" placeholder="Cari Nama / Barcode..." class="w-full p-inputtext-sm !rounded-lg" />
                </span>
                <div class="text-xs text-surface-500">
                    Total: <strong>{{ products.length }}</strong> Produk
                </div>
            </div>

            <DataTable 
                :value="products" 
                :loading="loading" 
                paginator :rows="10" 
                dataKey="uuid" 
                :filters="filters" 
                filterDisplay="menu"
                :globalFilterFields="['name', 'units.barcode']" 
                stripedRows
                tableStyle="min-width: 70rem"
                class="text-sm"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <i class="pi pi-box text-5xl mb-3 opacity-20"></i>
                        <p>Belum ada data produk.</p>
                    </div>
                </template>

                <Column field="name" header="Nama Produk" sortable style="width: 20%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex items-start gap-3 pt-2">
                            <div class="w-10 h-10 rounded bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold text-lg shrink-0">
                                {{ slotProps.data.name.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <span class="font-bold text-base text-surface-800 dark:text-surface-100 block leading-tight mb-1">
                                    {{ slotProps.data.name }}
                                </span>
                                <span class="text-[10px] text-surface-500 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded">
                                    {{ slotProps.data.units.length }} Varian Satuan
                                </span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Varian, Barcode & Harga" style="width: 45%" class="align-top">
                    <template #body="slotProps">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 py-1">
                            <div v-for="u in slotProps.data.units" :key="u.uuid" 
                                 class="relative flex flex-col bg-white dark:bg-surface-800 border rounded-lg overflow-hidden group transition-all hover:shadow-md"
                                 :class="u.uuid === slotProps.data.defaultUnitUuid ? 'border-primary-200 dark:border-primary-800 ring-1 ring-primary-100' : 'border-surface-200 dark:border-surface-700'">
                                
                                <div v-if="u.uuid === slotProps.data.defaultUnitUuid" class="absolute top-0 right-0 bg-primary-500 text-white text-[9px] px-1.5 py-0.5 rounded-bl-lg font-bold z-10">
                                    DEFAULT
                                </div>

                                <div class="px-3 py-2 bg-surface-50 dark:bg-surface-900/50 flex justify-between items-center border-b border-surface-100 dark:border-surface-700">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-surface-700 dark:text-surface-200">{{ u.unitName }}</span>
                                        <span class="text-[10px] text-surface-400 bg-white dark:bg-surface-800 px-1 rounded border border-surface-100">x{{ u.unitMultiplier }}</span>
                                    </div>
                                </div>

                                <div class="px-3 py-2 flex flex-col gap-1.5">
                                    <div class="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300" title="Barcode">
                                        <i class="pi pi-barcode text-surface-400"></i>
                                        <span class="font-mono tracking-wide bg-surface-100 dark:bg-surface-700 px-1 rounded">
                                            {{ u.barcode || '-' }}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2 text-xs" title="Harga Jual">
                                        <i class="pi pi-tag text-surface-400"></i>
                                        <span class="font-bold text-primary-600 dark:text-primary-400">
                                            {{ 
                                                (() => {
                                                    const p = slotProps.data.prices.find(pr => pr.unitUuid === u.uuid);
                                                    return p ? formatCurrency(p.price) : '-';
                                                })() 
                                            }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Stok" style="width: 20%" class="align-top">
                    <template #body="slotProps">
                        <div class="flex flex-col gap-1.5 py-1">
                            <div v-for="u in slotProps.data.units" :key="u.uuid + '_stok'" 
                                 class="flex justify-between items-center text-xs p-2 rounded bg-surface-50 dark:bg-surface-800/50 border border-transparent hover:border-surface-200 transition-colors">
                                <span class="font-medium text-surface-500 dark:text-surface-400">{{ u.unitName }}</span>
                                <div class="flex items-center gap-2">
                                    <span class="font-bold" 
                                        :class="(slotProps.data.stock.find(s => s.unitUuid === u.uuid)?.qty || 0) > 0 ? 'text-surface-900 dark:text-surface-100' : 'text-red-500'">
                                        {{ slotProps.data.stock.find(s => s.unitUuid === u.uuid)?.qty || 0 }}
                                    </span>
                                    <span class="w-2 h-2 rounded-full"
                                        :class="(slotProps.data.stock.find(s => s.unitUuid === u.uuid)?.qty || 0) > 10 ? 'bg-green-500' : 
                                                (slotProps.data.stock.find(s => s.unitUuid === u.uuid)?.qty || 0) > 0 ? 'bg-yellow-500' : 'bg-red-500'">
                                    </span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 10%" class="align-top text-center">
                    <template #body="slotProps">
                        <div class="flex flex-col gap-2 pt-2 items-center">
                            <Button icon="pi pi-pencil" text rounded severity="info" size="small" 
                                class="!w-8 !h-8 !p-0 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100"
                                @click="openEditModal(slotProps.data)" v-tooltip.left="'Edit Detail'" />
                            <Button icon="pi pi-trash" text rounded severity="danger" size="small" 
                                class="!w-8 !h-8 !p-0 bg-red-50 dark:bg-red-900/20 hover:bg-red-100"
                                @click="confirmDelete(slotProps.data)" v-tooltip.left="'Hapus'" />
                        </div>
                    </template>
                </Column>

            </DataTable>
        </div>

        <ProductCreateModal 
            v-model:visible="showModal" 
            :productUuid="selectedProductUuid"
            @product-created="onProductSaved" 
            @product-updated="onProductSaved" 
        />
    </div>
</template>

<style scoped>
/* Style tambahan untuk tampilan kartu */
.p-datatable .p-datatable-tbody > tr > td {
    vertical-align: top; /* Pastikan konten rata atas */
    padding-top: 1rem;
    padding-bottom: 1rem;
}
</style>