<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

// Asumsi auto-import composables
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
    // Total Nilai Retur (Semua tipe)
    const totalRefund = transactions.value.reduce((sum, t) => sum + Math.abs(t.total), 0);
    const count = transactions.value.length;
    
    // 1. Retur Penjualan (Customer mengembalikan barang)
    const countSaleReturn = transactions.value.filter(t => t.type === 'RT_SALE').length;
    const valueSaleReturn = transactions.value
        .filter(t => t.type === 'RT_SALE')
        .reduce((sum, t) => sum + Math.abs(t.total), 0);

    // 2. Retur Pembelian (Kita mengembalikan barang ke Supplier)
    const countBuyReturn = transactions.value.filter(t => t.type === 'RT_BUY').length;
    const valueBuyReturn = transactions.value
        .filter(t => t.type === 'RT_BUY')
        .reduce((sum, t) => sum + Math.abs(t.total), 0);

    return { totalRefund, count, countSaleReturn, valueSaleReturn, countBuyReturn, valueBuyReturn };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Fetch data produk untuk mapping nama produk
        const productsResponse = await productService.getAllProducts().catch(e => []);
        const productsData = Array.isArray(productsResponse) ? productsResponse : productsResponse?.data || [];
        
        productsMap.value = productsData.reduce((acc, curr) => {
            acc[curr.uuid] = curr;
            return acc;
        }, {});

        // 2. Fetch data Retur Penjualan & Retur Pembelian
        const [returnSaleResponse, returnBuyResponse] = await Promise.all([
             journalService.findAllByType('RT_SALE').catch(e => []),
             journalService.findAllByType('RT_BUY').catch(e => []),
        ]);

        const safeReturnSaleData = Array.isArray(returnSaleResponse) ? returnSaleResponse : returnSaleResponse?.data || [];
        const safeReturnBuyData = Array.isArray(returnBuyResponse) ? returnBuyResponse : returnBuyResponse?.data || [];

        const rawData = [...safeReturnSaleData, ...safeReturnBuyData];
        
        // 3. Transformasi Data
        transactions.value = rawData
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(journal => {
            
            const detailsMap = (journal.details || []).reduce((acc, curr) => {
                if (curr && curr.key) acc[curr.key] = curr.value;
                return acc;
            }, {});

            const count = Number(detailsMap['total_items_count'] || 0);
            const type = journal.code.startsWith('RT_SALE') ? 'RT_SALE' : 'RT_BUY';
            
            // Tentukan key harga berdasarkan tipe retur
            const priceKey = (type === 'RT_SALE') ? 'price#' : 'buy_price#';

            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const uUuid = detailsMap[`unit_uuid#${i}`];
                
                const productMaster = productsMap.value[pUuid];
                const unitMaster = productMaster?.units?.find(u => u.uuid === uUuid);
                
                const itemQty = Number(detailsMap[`qty#${i}`] || 0);
                const itemPrice = Math.abs(Number(detailsMap[`${priceKey}${i}`] || 0));
                const itemSubtotal = Math.abs(Number(detailsMap[`subtotal#${i}`] || 0));

                items.push({
                    productName: productMaster?.name || 'Produk Tidak Ditemukan',
                    unitName: unitMaster?.unitName || 'Unit',
                    qty: itemQty,
                    price: itemPrice,
                    subtotal: itemSubtotal,
                });
            }

            const total = Number(detailsMap['grand_total'] || 0);
            
            return {
                uuid: journal.uuid,
                code: journal.code || 'RT-' + journal.uuid.substr(0,8).toUpperCase(),
                type: type,
                date: journal.createdAt,
                // Tentukan nama pihak (Customer / Supplier)
                actor: type === 'RT_SALE' ? (detailsMap['customer_name'] || 'Pelanggan Umum') : (detailsMap['supplier'] || 'Supplier Umum'),
                refNo: detailsMap['reference_no'] || '-',
                notes: detailsMap['notes'] || '',
                total: total,
                items: items
            };
        });

    } catch (e) {
        console.error("Gagal memuat data retur:", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data retur.', life: 3000 });
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

const refreshData = async () => {
    await loadData();
}

onMounted(() => {
    loadData();
});

defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col h-full bg-surface-50 transition-colors duration-300">
        
        <div class="mb-8">
            <h1 class="text-2xl md:text-3xl font-bold  tracking-tight">Laporan Retur Barang</h1>
            <p class="text-surface-500  mt-1 text-sm">Rekapitulasi pengembalian barang dari pelanggan dan ke supplier.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
             
             <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-rose-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500  text-xs font-bold uppercase tracking-widest mb-1">Total Nilai Retur</p>
                        <h3 class="text-2xl font-black ">{{ formatCurrency(stats.totalRefund) }}</h3>
                    </div>
                    <div class="bg-rose-50  p-2.5 rounded-xl text-rose-600 ">
                        <i class="pi pi-arrow-right-arrow-left text-xl"></i>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-rose-600  font-medium bg-rose-50  w-fit px-2 py-1 rounded-lg">
                    <i class="pi pi-file text-[10px]"></i>
                    <span>Total {{ stats.count }} Nota</span>
                </div>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-orange-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500  text-xs font-bold uppercase tracking-widest mb-1">Retur Penjualan</p>
                        <h3 class="text-2xl font-black ">{{ formatCurrency(stats.valueSaleReturn) }}</h3>
                    </div>
                    <div class="bg-orange-50  p-2.5 rounded-xl text-orange-600 ">
                        <i class="pi pi-arrow-left text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 ">Barang masuk dari Pelanggan</p>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-blue-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500  text-xs font-bold uppercase tracking-widest mb-1">Retur Pembelian</p>
                        <h3 class="text-2xl font-black ">{{ formatCurrency(stats.valueBuyReturn) }}</h3>
                    </div>
                    <div class="bg-blue-50  p-2.5 rounded-xl text-blue-600 ">
                        <i class="pi pi-arrow-right text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 ">Barang keluar ke Supplier</p>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-slate-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500  text-xs font-bold uppercase tracking-widest mb-1">Rasio Retur</p>
                        <div class="flex items-baseline gap-2">
                             <h3 class="text-xl font-bold text-orange-600 ">{{ stats.countSaleReturn }} <span class="text-xs font-normal text-surface-500">Jual</span></h3>
                             <span class="text-surface-300">|</span>
                             <h3 class="text-xl font-bold text-blue-600 ">{{ stats.countBuyReturn }} <span class="text-xs font-normal text-surface-500">Beli</span></h3>
                        </div>
                    </div>
                    <div class="bg-slate-50 p-2.5 rounded-xl text-slate-600">
                        <i class="pi pi-chart-pie text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 ">Perbandingan jumlah nota</p>
            </div>
        </div>

        <div class="bg-surface-0 rounded-2xl shadow-sm border border-surface-200  flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-200  flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-0">
                <div class="w-full sm:w-auto relative">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <InputText v-model="filters['global'].value" placeholder="Cari Kode, Pelanggan, Supplier..." class="w-full sm:w-80 !pl-10 !rounded-xl" size="small" />
                </div>
                <div class="flex gap-2">
                     <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text size="small" @click="refreshData" />
                     <Button label="Export" icon="pi pi-file-excel" severity="secondary" outlined size="small" />
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
                rowHover
                class="flex-1 custom-table"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <div class="bg-surface-50 p-4 rounded-full mb-3">
                            <i class="pi pi-inbox text-4xl opacity-50"></i>
                        </div>
                        <p class="font-medium">Belum ada data retur barang.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                             <span class="font-bold font-mono text-sm tracking-tight"
                                :class="slotProps.data.type === 'RT_SALE' ? 'text-orange-600 ' : 'text-blue-600 '"
                            >
                                {{ slotProps.data.code }}
                            </span>
                            <div class="flex items-center gap-1.5 text-surface-500 text-[11px] mt-1">
                                <i class="pi pi-clock text-[10px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="type" header="Tipe Retur" sortable>
                    <template #body="slotProps">
                         <div class="flex items-center gap-2">
                            <div class="p-1.5 rounded-lg" :class="slotProps.data.type === 'RT_SALE' ? 'bg-orange-50 text-orange-600 ' : 'bg-blue-50 text-blue-600 '">
                                <i class="pi text-xs" :class="slotProps.data.type === 'RT_SALE' ? 'pi-arrow-left' : 'pi-arrow-right'"></i>
                            </div>
                            <span class="text-xs font-bold uppercase" :class="slotProps.data.type === 'RT_SALE' ? 'text-orange-700 ' : 'text-blue-700 '">
                                {{ slotProps.data.type === 'RT_SALE' ? 'Dari Pelanggan' : 'Ke Supplier' }}
                            </span>
                         </div>
                    </template>
                </Column>

                <Column field="actor" header="Pihak Terkait" sortable>
                     <template #body="slotProps">
                        <div class="flex flex-col">
                            <span class="font-medium ">{{ slotProps.data.actor }}</span>
                            <span v-if="slotProps.data.refNo !== '-'" class="text-[10px] text-surface-500 font-mono mt-0.5">Ref: {{ slotProps.data.refNo }}</span>
                        </div>
                    </template>
                </Column>
                
                <Column field="notes" header="Catatan">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.notes" class="text-xs  italic max-w-[150px] truncate block" :title="slotProps.data.notes">
                            "{{ slotProps.data.notes }}"
                        </span>
                        <span v-else class="text-surface-400 text-xs">-</span>
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <span class="inline-flex items-center justify-center bg-surface-100  text-xs font-bold px-2.5 py-1 rounded-md min-w-[2rem]">
                            {{ slotProps.data.items.length }}
                         </span>
                    </template>
                </Column>

                <Column field="total" header="Nilai Retur" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-bold text-sm"
                            :class="slotProps.data.type === 'RT_SALE' ? 'text-orange-600 ' : 'text-blue-600 '"
                        >
                            {{ formatCurrency(Math.abs(slotProps.data.total)) }}
                        </span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body>
                        <Button icon="pi pi-print" text rounded severity="secondary" size="small" class="hover:bg-surface-100" v-tooltip.left="'Cetak Bukti'" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50/50 border-y border-surface-200 ">
                        <div class="flex items-center gap-2 mb-3">
                            <i class="pi pi-box" :class="slotProps.data.type === 'RT_SALE' ? 'text-orange-500' : 'text-blue-500'"></i>
                            <h5 class="font-bold  text-xs uppercase tracking-wide">Rincian Barang</h5>
                        </div>
                        
                        <div class="rounded-xl border border-surface-200  overflow-hidden bg-surface-0 shadow-sm max-w-4xl">
                            <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                                <Column field="productName" header="Nama Produk">
                                    <template #body="i">
                                        <span class="font-medium ">{{ i.data.productName }}</span>
                                    </template>
                                </Column>
                                <Column field="unitName" header="Satuan" style="width: 100px">
                                    <template #body="i">
                                        <span class="bg-surface-100 px-2 py-0.5 rounded text-[10px] font-bold ">{{ i.data.unitName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty" class="text-center" style="width: 100px">
                                    <template #body="i">
                                        <span class="font-bold px-2 py-0.5 rounded font-mono"
                                            :class="slotProps.data.type === 'RT_SALE' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'"
                                        >
                                            {{ i.data.qty }}
                                        </span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga/Unit" class="text-right">
                                    <template #body="i">
                                        <span class="text-surface-500 ">{{ formatCurrency(i.data.price) }}</span>
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Total" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-900 ">{{ formatCurrency(Math.abs(i.data.subtotal)) }}</span>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </div>
                </template>

            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Styling khusus untuk DataTable agar menyatu dengan background */
:deep(.custom-table .p-datatable-thead > tr > th) {
    background-color: transparent;
    color: var(--p-surface-500);
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 700;
    padding-top: 1rem;
    padding-bottom: 1rem;
}

:deep(.custom-table .p-datatable-tbody > tr) {
    background-color: transparent;
    transition: background-color 0.2s;
}

:deep(.custom-table .p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-50);
}

.dark :deep(.custom-table .p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-700);
}

:deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-surface-100);
}

.dark :deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-surface-700);
}

/* Pagination Styling */
:deep(.p-paginator) {
    border-top: 1px solid var(--p-surface-200);
    background: transparent;
}
.dark :deep(.p-paginator) {
    border-top: 1px solid var(--p-surface-700);
}
</style>