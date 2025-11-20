<script setup>
import { ref, onMounted, computed } from 'vue';
// Pastikan service diimport dengan benar sesuai setup Nuxt/Project Anda
const journalService = useJournalService();
const productService = useProductService();

const transactions = ref([]);
const productsMap = ref({});
const loading = ref(true);
const expandedRows = ref({});

const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

// --- COMPUTED STATS (Untuk Dashboard Mini) ---
const stats = computed(() => {
    const total = transactions.value.reduce((a, b) => a + b.total, 0);
    const count = transactions.value.length;
    const average = count > 0 ? total / count : 0;
    
    // Mencari Supplier Terbanyak (Simple Logic)
    const supplierMap = {};
    transactions.value.forEach(t => {
        supplierMap[t.supplier] = (supplierMap[t.supplier] || 0) + 1;
    });
    const topSupplier = Object.keys(supplierMap).reduce((a, b) => supplierMap[a] > supplierMap[b] ? a : b, '-');

    return { total, count, average, topSupplier };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Load Master Produk
        const productsData = await productService.getAllProducts();
        productsMap.value = (productsData || []).reduce((acc, curr) => {
            acc[curr.uuid] = curr;
            return acc;
        }, {});

        // 2. Load Jurnal Pembelian
        const rawData = await journalService.getPurchaseReport();

        // 3. Parsing Data
        transactions.value = rawData.map(journal => {
            const detailsMap = journal.details.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});

            const count = Number(detailsMap['total_items_count'] || 0);
            
            // Reconstruct Items
            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const uUuid = detailsMap[`unit_uuid#${i}`];
                
                const productMaster = productsMap.value[pUuid];
                const unitMaster = productMaster?.units?.find(u => u.uuid === uUuid);

                items.push({
                    productName: productMaster?.name || 'Unknown Product',
                    unitName: unitMaster?.unitName || 'Unit',
                    qty: Number(detailsMap[`qty#${i}`]),
                    price: Number(detailsMap[`buy_price#${i}`] || 0),
                    subtotal: Number(detailsMap[`subtotal#${i}`] || 0),
                });
            }

            return {
                uuid: journal.uuid,
                code: journal.code,
                date: journal.createdAt,
                supplier: detailsMap['supplier'] || 'Umum',
                refNo: detailsMap['reference_no'] || '-',
                notes: detailsMap['notes'] || '',
                total: Number(detailsMap['grand_total'] || 0),
                items: items
            };
        });

    } catch (e) {
        console.error(e);
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
                    Laporan Pembelian
                </h1>
                <p class="text-surface-500 dark:text-surface-400">
                    Monitor pengeluaran stok dan riwayat belanja ke supplier.
                </p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" label="Refresh Data" severity="secondary" outlined class="!rounded-lg" @click="loadData" :loading="loading" />
                </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-wallet text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Pengeluaran</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.total) }}</h3>
                <p class="text-xs text-green-600 mt-2 font-medium flex items-center"><i class="pi pi-arrow-up mr-1 text-[10px]"></i> Akumulasi Total</p>
            </div>

            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-receipt text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Transaksi</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.count }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Data termuat</p>
            </div>

             <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-chart-pie text-6xl text-purple-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Rata-rata Belanja</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.average) }}</h3>
                <p class="text-xs text-surface-400 mt-2">Per Transaksi</p>
            </div>

            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-users text-6xl text-emerald-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Freq. Supplier Tertinggi</p>
                <h3 class="text-xl font-black text-surface-800 dark:text-surface-100 truncate" :title="stats.topSupplier">{{ stats.topSupplier }}</h3>
                <p class="text-xs text-emerald-600 mt-2 font-medium">Paling sering order</p>
            </div>
        </div>

        <div class="bg-white dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari Supplier, Kode..." class="w-full sm:w-80 !rounded-lg pl-10" />
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
                        <p>Belum ada data pembelian.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Info Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold text-primary-600 font-mono text-xs">{{ slotProps.data.code }}</span>
                            <div class="flex items-center gap-1 text-surface-500 text-[11px] mt-0.5">
                                <i class="pi pi-calendar text-[9px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier" sortable>
                     <template #body="slotProps">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-surface-500 font-bold text-xs">
                                {{ slotProps.data.supplier.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="font-bold text-surface-700 dark:text-surface-200">{{ slotProps.data.supplier }}</div>
                                <div v-if="slotProps.data.refNo !== '-'" class="text-[10px] text-surface-500 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                    Ref: {{ slotProps.data.refNo }}
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="notes" header="Catatan">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.notes" class="text-xs text-surface-600 italic max-w-[200px] truncate block" :title="slotProps.data.notes">
                            "{{ slotProps.data.notes }}"
                        </span>
                        <span v-else class="text-surface-400 text-xs">-</span>
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <Badge :value="slotProps.data.items.length" severity="warning" class="!min-w-[1.5rem] !h-[1.5rem]" />
                    </template>
                </Column>

                <Column field="total" header="Total Bayar" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-orange-600 text-sm">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body>
                        <Button icon="pi pi-ellipsis-v" text rounded severity="secondary" size="small" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-950/50 border-t border-b border-surface-200 dark:border-surface-800 shadow-inner">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-box text-orange-500 bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Rincian Barang Masuk</h5>
                        </div>
                        
                        <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                                <Column field="productName" header="Produk">
                                    <template #body="i">
                                        <span class="font-medium text-surface-700">{{ i.data.productName }}</span>
                                    </template>
                                </Column>
                                <Column field="unitName" header="Satuan" style="width: 100px">
                                    <template #body="i">
                                        <span class="bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded text-[10px] font-bold text-surface-600">{{ i.data.unitName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty Masuk" class="text-center" style="width: 100px">
                                    <template #body="i">
                                        <span class="font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">+{{ i.data.qty }}</span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga Beli" class="text-right">
                                    <template #body="i">
                                        {{ formatCurrency(i.data.price) }}
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Subtotal" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold">{{ formatCurrency(i.data.subtotal) }}</span>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                        
                        <div class="flex justify-end mt-3 gap-2">
                             <Button label="Cetak Bukti" icon="pi pi-print" size="small" severity="secondary" outlined class="!text-xs !py-1" />
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