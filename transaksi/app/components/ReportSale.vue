<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Asumsi services ini sudah di-inject/di-import dengan benar
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

// --- PAGINATION (PrimeVue Built-in) ---
// Note: Menggunakan built-in paginator di <DataTable>

// --- COMPUTED STATS ---
const stats = computed(() => {
    // Hanya hitung dari data yang sudah difilter/diproses di transactions.value
    const grossSales = transactions.value.filter(t => t.type === 'SALE' && !t.isReturn);
    
    // Total omset kotor (sebelum retur)
    const totalOmset = grossSales.reduce((sum, t) => sum + Math.abs(t.total), 0);
    
    // Total transaksi (SALE + RT_SALE)
    const totalTrx = transactions.value.length; 
    
    const average = totalTrx > 0 ? totalOmset / totalTrx : 0;
    
    // Hitung Total Piutang (Piutang hanya dicatat saat SALE kredit, totalnya positif)
    const totalPiutang = transactions.value
        .filter(t => t.isCredit && t.type === 'SALE' && !t.isReturn)
        .reduce((sum, t) => sum + Math.abs(t.total), 0);

    // Hitung total nota retur
    const totalReturnNotes = transactions.value.filter(t => t.isReturn).length;

    return { totalOmset, totalTrx, average, totalReturnNotes, totalPiutang };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Ambil data produk dan buat map (HARUS SUKSES)
        const productsResponse = await productService.getAllProducts();
        const productsData = Array.isArray(productsResponse) ? productsResponse : productsResponse?.data || [];
        
        productsMap.value = productsData.reduce((acc, curr) => {
            acc[curr.uuid] = curr.name;
            return acc;
        }, {});

        // 2. Fetch SALE dan RT_SALE (dengan safe handling)
        const [saleResponse, returnSaleResponse] = await Promise.all([
             // Coba fetch SALE, jika gagal kembalikan array kosong
             journalService.getSalesReport().catch(e => { console.error("Error fetching SALE:", e); return []; }),
             // Coba fetch RT_SALE, jika gagal kembalikan array kosong
             journalService.findAllByType('RT_SALE').catch(e => { console.error("Error fetching RT_SALE:", e); return []; }),
        ]);
        
        // Pastikan hasilnya adalah array atau ambil dari properti 'data' jika ada
        const safeSaleData = Array.isArray(saleResponse) ? saleResponse : saleResponse?.data || [];
        const safeReturnData = Array.isArray(returnSaleResponse) ? returnSaleResponse : returnSaleResponse?.data || [];

        const rawData = [
            ...safeSaleData, 
            ...safeReturnData
        ];
        
        // 3. Transformasi Data
        transactions.value = rawData
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by date desc
            .map(journal => {
            
            // Ambil details dan konversi ke map yang mudah diakses
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
                const itemPrice = Math.abs(Number(detailsMap[`price#${i}`] || 0)); // Gunakan Math.abs untuk harga per unit
                const itemSubtotal = Math.abs(Number(detailsMap[`subtotal#${i}`] || 0)); // Gunakan Math.abs untuk subtotal
                
                items.push({
                    productName: productsMap.value[pUuid] || 'Produk Tidak Ditemukan', // Ganti 'Unknown Product'
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
                total: total, // Biarkan total sesuai nilai asli (positif untuk SALE, negatif untuk RT_SALE)
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
    if (m === 'KREDIT') return 'danger'; // Piutang/Kredit
    if (m.includes('QRIS')) return 'info';
    if (m.includes('TRANSFER')) return 'warning';
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
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-950">
        
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-money-bill text-6xl text-emerald-600"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Omset Kotor</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalOmset) }}</h3>
                <p class="text-xs text-emerald-600 mt-2 font-medium flex items-center"><i class="pi pi-arrow-up mr-1 text-[10px]"></i> Sebelum dikurangi retur</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-receipt text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Jumlah Transaksi</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalTrx }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Termasuk retur penjualan</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-file-excel text-6xl text-red-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Retur Penjualan</p>
                <h3 class="text-xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalReturnNotes }} <span class="text-sm font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-red-500 mt-2 font-medium">Pengurangan Omset</p>
            </div>

             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-arrow-up-right text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Piutang</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalPiutang) }}</h3>
                <p class="text-xs text-orange-500 mt-2 font-medium">Penjualan Kredit Belum Lunas</p>
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari No. Transaksi, Pelanggan..." class="w-full sm:w-80 !rounded-lg pl-10" />
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

                <Column field="code" header="Info Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-xs"
                                :class="slotProps.data.isReturn ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'"
                            >
                                {{ slotProps.data.code }}
                            </span>
                            <div class="flex items-center gap-1 text-surface-500 text-[11px] mt-0.5">
                                <i class="pi pi-clock text-[9px]"></i>
                                <span>{{ formatDate(slotProps.data.date) }}</span>
                            </div>
                            <Tag v-if="slotProps.data.isCredit" value="Piutang" severity="warning" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                        </div>
                    </template>
                </Column>
                
                <Column field="customer" header="Pelanggan" sortable>
                     <template #body="slotProps">
                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ slotProps.data.customer || 'Umum' }}</span>
                    </template>
                </Column>

                <Column field="method" header="Pembayaran / Status" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.method" :severity="getMethodSeverity(slotProps.data.method)" rounded class="!text-[10px] !font-extrabold !px-2 uppercase" />
                         <div v-if="slotProps.data.isCredit" class="text-[10px] text-surface-500 mt-1">J.Tempo: {{ slotProps.data.dueDate ? new Date(slotProps.data.dueDate).toLocaleDateString('id-ID') : '-' }}</div>
                    </template>
                </Column>

                <Column field="items.length" header="Item" sortable class="text-center">
                    <template #body="slotProps">
                         <Badge :value="slotProps.data.items.length" :severity="slotProps.data.isReturn ? 'danger' : 'secondary'" class="!min-w-[1.5rem] !h-[1.5rem]" />
                    </template>
                </Column>

                <Column field="total" header="Total" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-sm"
                           :class="slotProps.data.isReturn ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'"
                        >
                            {{ formatCurrency(Math.abs(slotProps.data.total)) }}
                            <i v-if="slotProps.data.isReturn" class="pi pi-minus-circle text-[10px] ml-1"></i>
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
                            <i class="pi pi-shopping-cart text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Detail {{ slotProps.data.isReturn ? 'Pengembalian' : 'Penjualan' }}</h5>
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