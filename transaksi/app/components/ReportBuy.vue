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
    // Filter hanya transaksi NON-RETURN untuk menghitung total pengeluaran kotor
    const grossPurchases = transactions.value.filter(t => t.type === 'BUY' && !t.isReturn);
    // Menggunakan Math.abs karena total retur negatif
    const total = grossPurchases.reduce((a, b) => a + Math.abs(b.total), 0); 
    const count = transactions.value.length;
    const average = count > 0 ? total / count : 0;
    
    // Hitung Total Hutang (Hutang hanya dicatat saat BUY kredit)
    const totalHutang = transactions.value
        .filter(t => t.isCredit && t.type === 'BUY')
        .reduce((sum, t) => sum + Math.abs(t.total), 0);
    
    const supplierMap = {};
    transactions.value.filter(t => t.type === 'BUY').forEach(t => { 
        supplierMap[t.supplier] = (supplierMap[t.supplier] || 0) + 1;
    });
    const topSupplier = Object.keys(supplierMap).reduce((a, b) => supplierMap[a] > supplierMap[b] ? a : b, '-');

    const totalReturnNotes = transactions.value.filter(t => t.isReturn).length;

    return { total, count, average, topSupplier, totalHutang, totalReturnNotes };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Fetch data produk untuk productsMap (Mapping Nama Produk)
        const productsResponse = await productService.getAllProducts().catch(e => {
            console.error("Error fetching products:", e);
            return [];
        });
        const productsData = Array.isArray(productsResponse) ? productsResponse : productsResponse?.data || [];
        
        productsMap.value = productsData.reduce((acc, curr) => {
            acc[curr.uuid] = curr;
            return acc;
        }, {});

        // 2. Fetch transaksi BUY dan RT_BUY
        const [buyResponse, returnBuyResponse] = await Promise.all([
             journalService.getPurchaseReport().catch(e => { console.error("Error fetching BUY:", e); return []; }),
             journalService.findAllByType('RT_BUY').catch(e => { console.error("Error fetching RT_BUY:", e); return []; }),
        ]);

        const safeBuyData = Array.isArray(buyResponse) ? buyResponse : buyResponse?.data || [];
        const safeReturnBuyData = Array.isArray(returnBuyResponse) ? returnBuyResponse : returnBuyResponse?.data || [];

        const rawData = [
            ...safeBuyData, 
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
            const isReturn = journal.code.startsWith('RT_BUY');
            const isCredit = detailsMap['is_credit'] === 'true'; 
            
            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const uUuid = detailsMap[`unit_uuid#${i}`];
                
                const productMaster = productsMap.value[pUuid];
                const unitMaster = productMaster?.units?.find(u => u.uuid === uUuid);
                
                const itemQty = Number(detailsMap[`qty#${i}`] || 0);
                const itemPrice = Math.abs(Number(detailsMap[`buy_price#${i}`] || 0));
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
                code: journal.code || 'TRX-' + journal.uuid.substr(0,8).toUpperCase(),
                type: isReturn ? 'RT_BUY' : 'BUY',
                isReturn: isReturn,
                isCredit: isCredit, 
                date: journal.createdAt,
                supplier: detailsMap['supplier'] || 'Umum',
                refNo: detailsMap['reference_no'] || '-',
                notes: detailsMap['notes'] || '',
                total: total,
                dueDate: detailsMap['due_date'] || null, 
                items: items
            };
        });

    } catch (e) {
        console.error("Gagal total memuat data pembelian:", e);
        toast.add({ severity: 'error', summary: 'Error', detail: `Gagal memuat data pembelian: ${e.message || 'Cek koneksi API'}`, life: 5000 });
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

onMounted(() => {
    loadData();
});

const refreshData = async () => {
    await loadData();
}

defineExpose({ refreshData });
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-950">
        
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-wallet text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Pengeluaran Kotor</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.total) }}</h3>
                <p class="text-xs text-green-600 mt-2 font-medium flex items-center"><i class="pi pi-arrow-up mr-1 text-[10px]"></i> Akumulasi Total Pembelian</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-receipt text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Transaksi</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.count }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Termasuk retur pembelian</p>
            </div>

             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-file-excel text-6xl text-red-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Retur Pembelian</p>
                <h3 class="text-xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalReturnNotes }} <span class="text-sm font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-red-500 mt-2 font-medium">Pengurangan Pengeluaran</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-arrow-down-left text-6xl text-purple-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Hutang</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalHutang) }}</h3>
                <p class="text-xs text-purple-500 mt-2 font-medium">Pembelian Kredit Belum Lunas</p>
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
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
                             <span class="font-bold font-mono text-xs"
                                :class="slotProps.data.isReturn ? 'text-red-700 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'"
                            >
                                {{ slotProps.data.code }}
                            </span>
                            <div class="flex items-center gap-1 text-surface-500 text-[11px] mt-0.5">
                                <i class="pi pi-calendar text-[9px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                            <Tag v-if="slotProps.data.isCredit" value="Hutang" severity="danger" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
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
                
                 <Column field="method" header="Pembayaran / Status" sortable>
                    <template #body="slotProps">
                        <Tag 
                            :value="slotProps.data.isReturn ? 'RETUR' : slotProps.data.isCredit ? 'KREDIT' : 'CASH'" 
                            :severity="slotProps.data.isReturn ? 'danger' : slotProps.data.isCredit ? 'info' : 'success'" 
                            rounded 
                            class="!text-[10px] !font-extrabold !px-2 uppercase" 
                        />
                         <div v-if="slotProps.data.isCredit" class="text-[10px] text-surface-500 mt-1">J.Tempo: {{ slotProps.data.dueDate ? new Date(slotProps.data.dueDate).toLocaleDateString('id-ID') : '-' }}</div>
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
                         <Badge :value="slotProps.data.items.length" :severity="slotProps.data.isReturn ? 'danger' : 'warning'" class="!min-w-[1.5rem] !h-[1.5rem]" />
                    </template>
                </Column>

                <Column field="total" header="Total Bayar" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-sm"
                            :class="slotProps.data.isReturn ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'"
                        >
                            {{ formatCurrency(Math.abs(slotProps.data.total)) }}
                            <i v-if="slotProps.data.isReturn" class="pi pi-minus-circle text-[10px] ml-1"></i>
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
                            <i class="pi pi-box text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Rincian Barang {{ slotProps.data.isReturn ? 'Dikembalikan' : 'Masuk' }}</h5>
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
                                        <span class="bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded text-[10px] font-bold text-surface-600 dark:text-surface-300">{{ i.data.unitName }}</span>
                                    </template>
                                </Column>
                                <Column field="qty" header="Qty" class="text-center" style="width: 100px">
                                    <template #body="i">
                                        <span class="font-bold px-2 py-0.5 rounded"
                                            :class="slotProps.data.isReturn ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-green-600 bg-green-50 dark:bg-green-900/20'"
                                        >
                                            {{ slotProps.data.isReturn ? '-' : '+' }}{{ i.data.qty }}
                                        </span>
                                    </template>
                                </Column>
                                <Column field="price" header="Harga Beli" class="text-right">
                                    <template #body="i">
                                        <span class="text-surface-500 dark:text-surface-400">{{ formatCurrency(i.data.price) }}</span>
                                    </template>
                                </Column>
                                <Column field="subtotal" header="Subtotal" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-surface-900 dark:text-surface-100">{{ formatCurrency(Math.abs(i.data.subtotal)) }}</span>
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
/* Mengatasi latar belakang tabel utama */
:deep(.p-datatable) {
    /* Menjadikan latar belakang transparent dan menghapus latar belakang PrimeVue */
    background: transparent !important;
    border-color: transparent !important;
}

/* Mengatasi latar belakang header */
:deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-50) !important; /* Light Mode default */
    color: var(--p-text-color) !important;
    border-color: var(--p-surface-200) !important;
}

/* Memaksa warna header di Dark Mode */
.dark :deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-900) !important;
    color: var(--p-surface-100) !important;
    border-color: var(--p-surface-800) !important;
}

/* Mengatasi latar belakang baris */
:deep(.p-datatable-tbody > tr) {
    background-color: var(--p-surface-0) !important; /* Light Mode default (putih) */
    color: var(--p-text-color) !important;
    border-color: var(--p-surface-200) !important;
}

/* Mengatasi warna baris ganjil/genap (striped rows) */
:deep(.p-datatable-tbody .p-row-even) {
    background-color: var(--p-surface-50) !important; /* Light Mode striped */
}

/* Memaksa warna baris di Dark Mode */
.dark :deep(.p-datatable-tbody > tr) {
    background-color: var(--p-surface-900) !important; /* Default Dark Row */
}
.dark :deep(.p-datatable-tbody .p-row-even) {
    background-color: var(--p-surface-950) !important; /* Striped Dark Row (Genap) */
}
/* Memastikan warna baris ganjil di Dark Mode juga benar */
.dark :deep(.p-datatable-tbody .p-row-odd) {
     background-color: var(--p-surface-900) !important; /* Striped Dark Row (Ganjil) */
}

/* HOVER ROW FIX */
.dark :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-800) !important; 
}
:deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-100) !important; 
}

/* Penyesuaian agar isi tabel rata atas */
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    vertical-align: top;
    border-color: var(--p-surface-200); /* Border Light */
}
.dark :deep(.p-datatable .p-datatable-tbody > tr > td) {
    border-color: var(--p-surface-800); /* Border Dark */
}


.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>