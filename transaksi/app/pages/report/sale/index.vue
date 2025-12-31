<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Asumsi composables sudah auto-import di Nuxt
const productService = useProductService();
const journalService = useJournalService();
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
    // Filter transaksi SALE (bukan retur)
    const grossSales = transactions.value.filter(t => t.type === 'SALE' && !t.isReturn);
    
    // Total omset kotor (sebelum retur)
    const totalOmset = grossSales.reduce((sum, t) => sum + Math.abs(t.total), 0);
    
    // Total transaksi (SALE + RT_SALE)
    const totalTrx = transactions.value.length; 
    
    // Hitung Total Piutang (Hanya transaksi kredit yang belum lunas/status kredit)
    const totalPiutang = transactions.value
        .filter(t => t.isCredit && t.type === 'SALE' && !t.isReturn)
        .reduce((sum, t) => sum + Math.abs(t.total), 0);

    // Hitung total nota retur
    const totalReturnNotes = transactions.value.filter(t => t.isReturn).length;

    return { totalOmset, totalTrx, totalReturnNotes, totalPiutang };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Ambil data produk untuk mapping nama
        const productsResponse = await productService.getAllProducts();
        const productsData = Array.isArray(productsResponse) ? productsResponse : productsResponse?.data || [];
        
        productsMap.value = productsData.reduce((acc, curr) => {
            acc[curr.uuid] = curr.name;
            return acc;
        }, {});

        // 2. Fetch SALE dan RT_SALE secara paralel
        const [saleResponse, returnSaleResponse] = await Promise.all([
             journalService.getSalesReport().catch(e => { console.error("Error fetching SALE:", e); return []; }),
             journalService.findAllByType('RT_SALE').catch(e => { console.error("Error fetching RT_SALE:", e); return []; }),
        ]);
        
        const safeSaleData = Array.isArray(saleResponse) ? saleResponse : saleResponse?.data || [];
        const safeReturnData = Array.isArray(returnSaleResponse) ? returnSaleResponse : returnSaleResponse?.data || [];

        const rawData = [...safeSaleData, ...safeReturnData];
        
        // 3. Transformasi Data
        transactions.value = rawData
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Urutkan terbaru
            .map(journal => {
            
            // Konversi details array ke object map
            const detailsMap = Array.isArray(journal.details) 
                ? journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {}) 
                : (journal.details || {});

            const isReturn = journal.code.startsWith('RT_SALE'); 
            const isCredit = detailsMap['is_credit'] === 'true'; 
            const count = Number(detailsMap['total_items_count'] || 0);
            const total = Number(detailsMap['grand_total'] || 0);
            
            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const itemQty = Number(detailsMap[`qty#${i}`] || 0);
                const itemPrice = Math.abs(Number(detailsMap[`price#${i}`] || 0));
                const itemSubtotal = Math.abs(Number(detailsMap[`subtotal#${i}`] || 0));
                
                items.push({
                    productName: productsMap.value[pUuid] || 'Produk Tidak Ditemukan',
                    qty: itemQty,
                    price: itemPrice,
                    subtotal: itemSubtotal,
                });
            }

            return {
                uuid: journal.uuid,
                code: journal.code || 'TRX-' + journal.uuid.substr(0,8).toUpperCase(),
                type: isReturn ? 'RT_SALE' : 'SALE',
                isReturn: isReturn,
                isCredit: isCredit, 
                date: journal.createdAt,
                total: total, 
                method: detailsMap['payment_method'] || (isCredit ? 'KREDIT' : 'CASH'),
                customer: detailsMap['customer_name'] || '-', 
                dueDate: detailsMap['due_date'] || null,
                items: items 
            };
        });

    } catch (e) {
        console.error("Gagal memuat data", e);
        toast.add({ severity: 'error', summary: 'Error', detail: `Gagal memuat data: ${e.message}`, life: 5000 });
        transactions.value = [];
    } finally {
        loading.value = false;
    }
};

// --- FORMATTERS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if(!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const getMethodSeverity = (method) => {
    const m = (method || '').toUpperCase();
    if (m === 'CASH' || m === 'TUNAI') return 'success';
    if (m === 'KREDIT') return 'warning';
    if (m.includes('QRIS') || m.includes('TRANSFER')) return 'info';
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
    <div class="flex flex-col h-full bg-surface-50 dark:bg-surface-100 transition-colors duration-300">
        
        <div class="mb-8">
            <h1 class="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-0 tracking-tight">Laporan Penjualan</h1>
            <p class="text-surface-500 dark:text-surface-400 mt-1 text-sm">Ringkasan transaksi penjualan, retur, dan piutang toko Anda.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-emerald-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Total Omset</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ formatCurrency(stats.totalOmset) }}</h3>
                    </div>
                    <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <i class="pi pi-money-bill text-xl"></i>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 w-fit px-2 py-1 rounded-lg">
                    <i class="pi pi-arrow-up text-[10px]"></i>
                    <span>Pendapatan Kotor</span>
                </div>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-blue-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Transaksi</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ stats.totalTrx }} <span class="text-sm font-medium text-surface-400">Nota</span></h3>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-500/10 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
                        <i class="pi pi-receipt text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400">Akumulasi Penjualan & Retur</p>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-rose-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Total Retur</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ stats.totalReturnNotes }} <span class="text-sm font-medium text-surface-400">Nota</span></h3>
                    </div>
                    <div class="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl text-rose-600 dark:text-rose-400">
                        <i class="pi pi-refresh text-xl"></i>
                    </div>
                </div>
                 <div class="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-500/10 w-fit px-2 py-1 rounded-lg">
                    <i class="pi pi-exclamation-circle text-[10px]"></i>
                    <span>Barang Kembali</span>
                </div>
            </div>

             <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-orange-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Piutang Aktif</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ formatCurrency(stats.totalPiutang) }}</h3>
                    </div>
                    <div class="bg-orange-50 dark:bg-orange-500/10 p-2.5 rounded-xl text-orange-600 dark:text-orange-400">
                        <i class="pi pi-wallet text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400">Pembayaran Kredit / Tempo</p>
            </div>
        </div>

        <div class="bg-surface-0 dark:bg-surface-100 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-0 dark:bg-surface-100">
                <div class="w-full sm:w-auto relative">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <InputText v-model="filters['global'].value" placeholder="Cari No. Nota, Pelanggan..." class="w-full sm:w-80 !pl-10 !rounded-xl" size="small" />
                </div>
                <div class="flex gap-2">
                     <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text size="small" @click="refreshData" />
                     <Button label="Export" icon="pi pi-download" severity="secondary" outlined size="small" />
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
                class="flex-1 custom-table"
                rowHover
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <div class="bg-surface-50 dark:bg-surface-700 p-4 rounded-full mb-3">
                            <i class="pi pi-inbox text-4xl opacity-50"></i>
                        </div>
                        <p class="font-medium">Belum ada transaksi penjualan.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-sm tracking-tight"
                                :class="slotProps.data.isReturn ? 'text-rose-600 dark:text-rose-400' : 'text-primary-600 dark:text-primary-400'"
                            >
                                {{ slotProps.data.code }}
                            </span>
                            <div class="flex items-center gap-1.5 text-surface-500 text-[11px] mt-1">
                                <i class="pi pi-calendar text-[10px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="customer" header="Pelanggan" sortable>
                     <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <Avatar :label="slotProps.data.customer ? slotProps.data.customer.charAt(0).toUpperCase() : 'U'" shape="circle" size="small" class="!bg-surface-200 dark:!bg-surface-700 !text-surface-600 dark:!text-surface-300 !text-xs" />
                            <span class="font-medium text-surface-700 dark:text-surface-200">{{ slotProps.data.customer || 'Pelanggan Umum' }}</span>
                        </div>
                    </template>
                </Column>

                <Column field="method" header="Status" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col gap-1 items-start">
                            <Tag :value="slotProps.data.method" :severity="getMethodSeverity(slotProps.data.method)" rounded class="!text-[10px] !font-bold !px-2 uppercase tracking-wide" />
                            <span v-if="slotProps.data.isReturn" class="text-[10px] text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded">RETUR</span>
                            <span v-if="slotProps.data.isCredit" class="text-[10px] text-orange-500 font-medium">Jatuh Tempo: {{ slotProps.data.dueDate ? new Date(slotProps.data.dueDate).toLocaleDateString('id-ID') : '-' }}</span>
                        </div>
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <span class="inline-flex items-center justify-center bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 text-xs font-bold px-2.5 py-1 rounded-md min-w-[2rem]">
                            {{ slotProps.data.items.length }}
                         </span>
                    </template>
                </Column>

                <Column field="total" header="Total" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-bold text-sm"
                           :class="slotProps.data.isReturn ? 'text-rose-600 dark:text-rose-400' : 'text-surface-900 dark:text-surface-0'"
                        >
                            {{ slotProps.data.isReturn ? '-' : '' }}{{ formatCurrency(Math.abs(slotProps.data.total)) }}
                        </span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body>
                        <Button icon="pi pi-print" text rounded severity="secondary" size="small" class="hover:bg-surface-100 dark:hover:bg-surface-700" v-tooltip.left="'Cetak Struk'" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-100/50 border-y border-surface-200 dark:border-surface-700">
                        <div class="flex items-center gap-2 mb-3">
                            <i class="pi pi-list text-primary-500"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Detail Produk</h5>
                        </div>
                        
                        <div class="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden bg-surface-0 dark:bg-surface-100 shadow-sm max-w-3xl">
                            <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                                <Column field="productName" header="Nama Produk">
                                    <template #body="i">
                                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ i.data.productName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty" class="text-center" style="width: 80px">
                                    <template #body="i">
                                        <span class="font-mono font-bold text-surface-600 dark:text-surface-300">x{{ i.data.qty }}</span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga" class="text-right">
                                    <template #body="i">
                                        <span class="text-surface-500">{{ formatCurrency(i.data.price) }}</span>
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Subtotal" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-900 dark:text-surface-100">{{ formatCurrency(Math.abs(i.data.subtotal)) }}</span>
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