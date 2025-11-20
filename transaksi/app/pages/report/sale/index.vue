<script setup>
import { ref, onMounted, computed } from 'vue';
// Sesuaikan import service dengan struktur project Anda
const journalService = useJournalService();
const productService = useProductService();

const transactions = ref([]);
const productsMap = ref({});
const loading = ref(true);
const expandedRows = ref({});
const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

// --- COMPUTED STATS (Dashboard Mini) ---
const stats = computed(() => {
    const totalOmset = transactions.value.reduce((sum, t) => sum + t.total, 0);
    const totalTrx = transactions.value.length;
    const average = totalTrx > 0 ? totalOmset / totalTrx : 0;
    
    // Hitung total items terjual
    const totalItems = transactions.value.reduce((sum, t) => {
        return sum + t.items.reduce((s, i) => s + i.qty, 0);
    }, 0);

    return { totalOmset, totalTrx, average, totalItems };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Load Master Produk (Untuk lookup nama produk dari UUID)
        const productsData = await productService.getAllProducts();
        productsMap.value = (productsData || []).reduce((acc, curr) => {
            acc[curr.uuid] = curr.name;
            return acc;
        }, {});

        // 2. Load Laporan Penjualan
        const rawData = await journalService.getSalesReport();
        
        // 3. Parsing Data
        transactions.value = rawData.map(journal => {
            const detailsMap = Array.isArray(journal.details) 
                ? journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {}) 
                : (journal.details || {});

            const count = Number(detailsMap['total_items_count'] || 0);
            
            // Reconstruct Items
            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                items.push({
                    productName: productsMap.value[pUuid] || 'Unknown Product',
                    qty: Number(detailsMap[`qty#${i}`] || 0),
                    price: Number(detailsMap[`price#${i}`] || 0),
                    subtotal: Number(detailsMap[`subtotal#${i}`] || 0),
                });
            }

            return {
                uuid: journal.uuid,
                code: journal.code || journal.transactionNo || 'TRX-' + journal.uuid.substr(0,8).toUpperCase(),
                date: journal.createdAt,
                total: Number(detailsMap['grand_total'] || 0),
                method: detailsMap['payment_method'] || 'CASH', // Default CASH
                items: items 
            };
        });

    } catch (e) {
        console.error("Gagal memuat data", e);
    } finally {
        loading.value = false;
    }
};

// --- FORMATTERS & UTILS ---
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
    if (m === 'CASH') return 'success';
    if (m.includes('QRIS')) return 'info';
    if (m.includes('TRANSFER')) return 'warning';
    return 'secondary';
};

onMounted(() => {
    loadData();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 md:p-6 animate-fade-in font-sans">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight mb-1">
                    Laporan Penjualan
                </h1>
                <p class="text-surface-500 dark:text-surface-400">
                    Rekapitulasi omset harian dan detail transaksi kasir.
                </p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Refresh" severity="secondary" outlined class="!rounded-lg" @click="loadData" :loading="loading" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-money-bill text-6xl text-emerald-600"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Omset</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalOmset) }}</h3>
                <p class="text-xs text-emerald-600 mt-2 font-medium flex items-center"><i class="pi pi-arrow-up mr-1 text-[10px]"></i> Pendapatan Kotor</p>
            </div>

            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-receipt text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Jumlah Transaksi</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalTrx }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Pelanggan dilayani</p>
            </div>

            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-chart-line text-6xl text-purple-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Rata-rata Transaksi</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.average) }}</h3>
                <p class="text-xs text-surface-400 mt-2">Per Nota / Pelanggan</p>
            </div>

             <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-box text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Produk Terjual</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalItems }} <span class="text-base font-normal text-surface-400">Pcs</span></h3>
                <p class="text-xs text-orange-500 mt-2 font-medium">Total Kuantitas</p>
            </div>
        </div>

        <div class="bg-white dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari No. Transaksi..." class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                     <Button label="Filter Periode" icon="pi pi-calendar" severity="secondary" text size="small" />
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
                class="text-sm"
                rowHover
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <i class="pi pi-shopping-bag text-4xl mb-2 opacity-50"></i>
                        <p>Belum ada transaksi penjualan.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No. Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold text-emerald-700 font-mono text-xs">{{ slotProps.data.code }}</span>
                            <div class="flex items-center gap-1 text-surface-500 text-[11px] mt-0.5">
                                <i class="pi pi-clock text-[9px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="method" header="Pembayaran" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.method" :severity="getMethodSeverity(slotProps.data.method)" rounded class="!text-[10px] !font-extrabold !px-2 uppercase" />
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <Badge :value="slotProps.data.items.length" severity="secondary" class="!min-w-[1.5rem] !h-[1.5rem]" />
                    </template>
                </Column>

                <Column field="total" header="Total Omset" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-emerald-600 text-sm">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body>
                        <Button icon="pi pi-print" text rounded severity="secondary" size="small" v-tooltip.left="'Cetak Struk'" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-emerald-50/50 dark:bg-surface-950/50 border-t border-b border-surface-200 dark:border-surface-800 shadow-inner">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-shopping-cart text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Detail Keranjang Belanja</h5>
                        </div>
                        
                        <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden bg-white dark:bg-surface-900">
                            <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                                <Column field="productName" header="Produk">
                                    <template #body="i">
                                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ i.data.productName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty" class="text-center" style="width: 80px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700">x{{ i.data.qty }}</span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga Satuan" class="text-right">
                                    <template #body="i">
                                        <span class="text-surface-500">{{ formatCurrency(i.data.price) }}</span>
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Subtotal" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-900 dark:text-surface-100">{{ formatCurrency(i.data.subtotal) }}</span>
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
.animate-fade-in {
    animation: fadeIn 0.4s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>