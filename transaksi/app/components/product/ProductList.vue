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

        const rawData = Array.isArray(response) ? response : (response.data || []);
        const meta = response.meta || response.pagination || {};

        // Mapping sederhana: Hanya ambil UUID dan Nama
        products.value = rawData.map(p => ({
            uuid: p.uuid,
            name: p.name || '-',
            // Opsional: Ambil nama kategori pertama jika ada, untuk konteks
            categoryName: p.productCategory?.[0]?.category?.name || '' 
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

onMounted(() => {
    fetchProducts();
});

defineExpose({ refresh });
</script>

<template>
    <div class="flex flex-col h-full gap-4">
        <div class="flex flex-col md:flex-row justify-between items-center gap-3 bg-surface-0 p-3 rounded-xl border border-surface-200 shadow-sm">
             <div class="relative w-full md:w-96 group">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 transition-colors"></i>
                <InputText 
                    v-model="searchInput" 
                    placeholder="Cari Nama Produk..." 
                    class="w-full pl-10 rounded-full !bg-surface-50 focus:!bg-surface-0 transition-all border-none ring-1 ring-surface-200 focus:ring-primary-500" 
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

        <div class="flex-1 overflow-hidden border border-surface-200 rounded-xl bg-surface-0 shadow-sm flex flex-col">
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
                        <i class="pi pi-box text-3xl opacity-50 mb-2"></i>
                        <p class="font-medium">Tidak ada produk ditemukan.</p>
                    </div>
                </template>

                <template #loading>
                    <div class="p-4 space-y-3">
                        <Skeleton height="3rem" v-for="i in 5" :key="i" class="!rounded-lg" />
                    </div>
                </template>

                <Column header="Nama Produk" style="min-width: 300px">
                    <template #body="{ data }">
                        <div class="flex gap-3 items-center py-1">
                            <div class="w-9 h-9 rounded-full bg-surface-100 text-surface-600 flex items-center justify-center font-bold text-sm shrink-0">
                                {{ data.name.charAt(0).toUpperCase() }}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-sm text-surface-900">{{ data.name }}</span>
                                <span v-if="data.categoryName" class="text-xs text-surface-500">{{ data.categoryName }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 100px; text-align: center" alignFrozen="right">
                    <template #body="{ data }">
                        <div class="flex justify-center gap-1">
                            <Button 
                                icon="pi pi-pencil" 
                                text
                                rounded 
                                severity="info"
                                size="small"
                                v-tooltip.top="'Edit'" 
                                @click="handleEdit(data)" 
                                class="!w-8 !h-8"
                            />
                            <Button 
                                icon="pi pi-trash" 
                                text
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
    </div>
</template>