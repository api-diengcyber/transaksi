<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const productService = useProductService();
const toast = useToast();

const transactions = ref([]);
const productsMap = ref({});
const loading = ref(true);
const expandedRows = ref({});

const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

// --- COMPUTED STATS ---
const stats = computed(() => {
    // Total Nilai Retur (total dari Math.abs(grand_total))
    const totalRefund = transactions.value.reduce((sum, t) => sum + Math.abs(t.total), 0);
    const count = transactions.value.length;
    
    // Hitung total Retur Penjualan (RT_SALE) dan Retur Pembelian (RT_BUY)
    const countSaleReturn = transactions.value.filter(t => t.type === 'RT_SALE').length;
    const countBuyReturn = transactions.value.filter(t => t.type === 'RT_BUY').length;
    
    // Total Nilai Retur Penjualan (RT_SALE, ini adalah pengembalian dana ke pelanggan)
    const valueSaleReturn = transactions.value
        .filter(t => t.type === 'RT_SALE')
        .reduce((sum, t) => sum + Math.abs(t.total), 0);

    return { totalRefund, count, countSaleReturn, countBuyReturn, valueSaleReturn };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Fetch data produk untuk productsMap
        const productsResponse = await productService.getAllProducts().catch(e => {
            console.error("Error fetching products:", e);
            return [];
        });
        const productsData = Array.isArray(productsResponse) ? productsResponse : productsResponse?.data || [];
        
        productsMap.value = productsData.reduce((acc, curr) => {
            acc[curr.uuid] = curr;
            return acc;
        }, {});

        // 2. Fetch data Retur Penjualan dan Retur Pembelian
        const [returnSaleResponse, returnBuyResponse] = await Promise.all([
             journalService.findAllByType('RT_SALE').catch(e => { console.error("Error fetching RT_SALE:", e); return []; }),
             journalService.findAllByType('RT_BUY').catch(e => { console.error("Error fetching RT_BUY:", e); return []; }),
        ]);

        const safeReturnSaleData = Array.isArray(returnSaleResponse) ? returnSaleResponse : returnSaleResponse?.data || [];
        const safeReturnBuyData = Array.isArray(returnBuyResponse) ? returnBuyResponse : returnBuyResponse?.data || [];

        const rawData = [
            ...safeReturnSaleData, 
            ...safeReturnBuyData
        ];
        
        // 3. Map Data Safely
        transactions.value = rawData
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(journal => {
            
            const journalDetails = journal.details || [];
            
            const detailsMap = journalDetails.reduce((acc, curr) => {
                if (curr && curr.key) {
                    acc[curr.key] = curr.value;
                }
                return acc;
            }, {});

            const count = Number(detailsMap['total_items_count'] || 0);
            const type = journal.code.startsWith('RT_SALE') ? 'RT_SALE' : 'RT_BUY';
            
            const items = [];
            // Deteksi kunci harga yang benar (price# untuk SALE, buy_price# untuk BUY)
            const priceKey = (type === 'RT_SALE') ? 'price#' : 'buy_price#';

            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const uUuid = detailsMap[`unit_uuid#${i}`];
                
                const productMaster = productsMap.value[pUuid];
                const unitMaster = productMaster?.units?.find(u => u.uuid === uUuid);
                
                const itemQty = Number(detailsMap[`qty#${i}`] || 0);
                const itemPrice = Math.abs(Number(detailsMap[`${priceKey}${i}`] || 0)); // Gunakan Math.abs
                const itemSubtotal = Math.abs(Number(detailsMap[`subtotal#${i}`] || 0));

                items.push({
                    productName: productMaster?.name || 'Produk Tidak Ditemukan',
                    unitName: unitMaster?.unitName || 'Unit',
                    qty: itemQty,
                    price: itemPrice,
                    subtotal: itemSubtotal,
                });
            }

            const total = Number(detailsMap['grand_total'] || 0); // Nilai ini HARUS negatif/positif sesuai retur
            
            return {
                uuid: journal.uuid,
                code: journal.code || 'RT-' + journal.uuid.substr(0,8).toUpperCase(),
                type: type,
                date: journal.createdAt,
                // Data Pelaku Retur
                actor: type === 'RT_SALE' ? detailsMap['customer_name'] || 'Pelanggan' : detailsMap['supplier'] || 'Supplier',
                refNo: detailsMap['reference_no'] || '-',
                notes: detailsMap['notes'] || '',
                total: total,
                items: items
            };
        });

    } catch (e) {
        console.error("Gagal total memuat data retur:", e);
        toast.add({ severity: 'error', summary: 'Error', detail: `Gagal memuat data retur: ${e.message || 'Cek koneksi API'}`, life: 5000 });
        transactions.value = [];
    } finally {
        loading.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const getSeverity = (type) => {
    if (type === 'RT_SALE') return 'danger';
    if (type === 'RT_BUY') return 'info';
    return 'secondary';
};

onMounted(() => {
    loadData();
});

const refreshData = async () => {
    await loadData();
}

defineExpose({ refreshData });
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-400">
        
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-file-excel text-6xl text-red-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Nota Retur</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.count }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-red-500 mt-2 font-medium">Pengembalian ke/dari pelanggan/supplier</p>
            </div>
             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-arrow-left-to-line text-6xl text-red-600"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Nilai Retur Penjualan</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.valueSaleReturn) }}</h3>
                <p class="text-xs text-red-600 mt-2 font-medium">Pengembalian dana kepada pelanggan</p>
            </div>
             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-user-minus text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Retur Penjualan</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.countSaleReturn }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-orange-500 mt-2 font-medium">Barang kembali dari pelanggan</p>
            </div>
             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-user-plus text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Retur Pembelian</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.countBuyReturn }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Barang dikembalikan ke supplier</p>
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-400">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari Kode, Pelanggan/Supplier..." class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                     <Button label="Filter Tanggal" icon="pi pi-calendar" severity="secondary" text size="small" />
                     <Button label="Export" icon="pi pi-file-excel" severity="success" text size="small" />
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="transactions" 
                dataKey="uuid"
                :loading="loading"
                paginator :rows="10" :rowsPerPageOptions="[10,20,50]"
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                rowHover
                class="text-sm"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <i class="pi pi-inbox text-4xl mb-2 opacity-50"></i>
                        <p>Belum ada data retur.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Info Retur" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                             <span class="font-bold font-mono text-xs"
                                :class="slotProps.data.type === 'RT_SALE' ? 'text-red-700 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'"
                            >
                                {{ slotProps.data.code }}
                            </span>
                            <div class="flex items-center gap-1 text-surface-500 text-[11px] mt-0.5">
                                <i class="pi pi-calendar text-[9px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="type" header="Tipe" sortable>
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.type === 'RT_SALE' ? 'RETUR JUAL' : 'RETUR BELI'" 
                            :severity="getSeverity(slotProps.data.type)" 
                            rounded 
                            class="!text-[10px] !font-extrabold !px-2 uppercase" 
                        />
                    </template>
                </Column>

                <Column field="actor" header="Pihak Terkait" sortable>
                     <template #body="slotProps">
                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ slotProps.data.actor }}</span>
                        <div v-if="slotProps.data.refNo !== '-'" class="text-[10px] text-surface-500 bg-surface-100 dark:bg-surface-400 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            Ref: {{ slotProps.data.refNo }}
                        </div>
                    </template>
                </Column>
                
                <Column field="notes" header="Catatan">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.notes" class="text-xs text-surface-600 dark:text-surface-300 italic max-w-[200px] truncate block" :title="slotProps.data.notes">
                            "{{ slotProps.data.notes }}"
                        </span>
                        <span v-else class="text-surface-400 text-xs">-</span>
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <Badge :value="slotProps.data.items.length" severity="secondary" class="!min-w-[1.5rem] !h-[1.5rem]" />
                    </template>
                </Column>

                <Column field="total" header="Nilai Retur" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-sm"
                            :class="slotProps.data.type === 'RT_SALE' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'"
                        >
                            {{ formatCurrency(Math.abs(slotProps.data.total)) }}
                            <i class="pi pi-arrow-left-to-line text-[10px] ml-1"></i>
                        </span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body>
                        <Button icon="pi pi-print" text rounded severity="secondary" size="small" v-tooltip.left="'Cetak Bukti Retur'" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-400 border-t border-b border-surface-200 dark:border-surface-800 shadow-inner">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-list text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Rincian Produk Retur</h5>
                        </div>
                        
                        <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                                <Column field="productName" header="Produk">
                                    <template #body="i">
                                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ i.data.productName }}</span>
                                    </template>
                                </Column>
                                <Column field="unitName" header="Satuan" style="width: 100px">
                                    <template #body="i">
                                        <span class="bg-surface-100 dark:bg-surface-400 px-2 py-0.5 rounded text-[10px] font-bold text-surface-600 dark:text-surface-300">{{ i.data.unitName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty" class="text-center" style="width: 100px">
                                    <template #body="i">
                                        <span class="font-bold px-2 py-0.5 rounded text-red-600 bg-red-50 dark:bg-red-900/20">
                                            -{{ i.data.qty }}
                                        </span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga Retur/Unit" class="text-right">
                                    <template #body="i">
                                        <span class="text-surface-500 dark:text-surface-400">{{ formatCurrency(i.data.price) }}</span>
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Subtotal Nilai" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-900 dark:text-surface-100">{{ formatCurrency(Math.abs(i.data.subtotal)) }}</span>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                        
                        <div class="flex justify-end mt-3 gap-2">
                             <Button label="Cetak Ulang" icon="pi pi-print" size="small" severity="secondary" outlined class="!text-xs !py-1" />
                        </div>
                    </div>
                </template>

            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Style PrimeVue (diambil dari komponen sebelumnya) */
:deep(.p-datatable) { background: transparent !important; border-color: transparent !important; }
:deep(.p-datatable-thead > tr > th) { background-color: var(--p-surface-50) !important; color: var(--p-text-color) !important; border-color: var(--p-surface-200) !important; }
.dark :deep(.p-datatable-thead > tr > th) { background-color: var(--p-surface-900) !important; color: var(--p-surface-100) !important; border-color: var(--p-surface-800) !important; }
:deep(.p-datatable-tbody > tr) { background-color: var(--p-surface-0) !important; color: var(--p-text-color) !important; border-color: var(--p-surface-200) !important; }
:deep(.p-datatable-tbody .p-row-even) { background-color: var(--p-surface-50) !important; }
.dark :deep(.p-datatable-tbody > tr) { background-color: var(--p-surface-900) !important; }
.dark :deep(.p-datatable-tbody .p-row-even) { background-color: var(--p-surface-950) !important; }
.dark :deep(.p-datatable-tbody .p-row-odd) { background-color: var(--p-surface-900) !important; }
.dark :deep(.p-datatable-tbody > tr:hover) { background-color: var(--p-surface-800) !important; }
:deep(.p-datatable-tbody > tr:hover) { background-color: var(--p-surface-100) !important; }
:deep(.p-datatable .p-datatable-tbody > tr > td) { vertical-align: top; border-color: var(--p-surface-200); }
.dark :deep(.p-datatable .p-datatable-tbody > tr > td) { border-color: var(--p-surface-800); }
</style>