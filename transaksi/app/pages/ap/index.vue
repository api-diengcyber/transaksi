<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useJournalService } from '~/composables/useJournalService';
import { useSupplierService } from '~/composables/useSupplierService';

// Import komponen modal
import ApCreateModal from '~/components/ap/ApCreateModal.vue';
import PaymentApModal from '~/components/payment/PaymentApModal.vue';

const journalService = useJournalService();
const supplierService = useSupplierService(); 
const toast = useToast();

const rawDebts = ref([]); 
const suppliers = ref([]); 
const loading = ref(true);
const expandedRows = ref({}); 

// --- STATE MODAL ---
const showCreateModal = ref(false);
const showPaymentModal = ref(false);
const selectedDebt = ref(null);

// --- STATE PAGINASI, PENCARIAN & TANGGAL API ---
const pagination = ref({ page: 1, limit: 15 });
const totalRecords = ref(0);
const searchQuery = ref('');

// Inisialisasi filter tanggal (Default: 30 hari terakhir)
const today = new Date();
const lastMonth = new Date();
lastMonth.setDate(today.getDate() - 30);
const dates = ref([lastMonth, today]); 

// --- STATE SUMMARY (Diberikan dari Server) ---
const summary = ref({
    totalHutang: 0,
    totalTerbayar: 0,
    totalSisaHutang: 0
});

// --- COMPUTED UNTUK DAFTAR & JUMLAH JATUH TEMPO ---
const hutangList = computed(() => {
    // Kita menampung data dari backend di computed ini
    // Backend API sudah disetel untuk mengembalikan data sesuai filter (Paginasi/Search/Date)
    return rawDebts.value; 
});

const jatuhTempoCount = computed(() => {
    // Menghitung jumlah yang lewat jatuh tempo HANYA dari data yang sedang diload
    return hutangList.value.filter(d => 
        d.remaining > 0 && 
        d.dueDate && 
        new Date(d.dueDate) < new Date(new Date().setHours(0,0,0,0))
    ).length;
});

// --- FETCH MASTER SUPPLIER ---
const loadSuppliers = async () => {
    try {
        let sData = null;
        if (supplierService.getSuppliers) sData = await supplierService.getSuppliers();
        else if (supplierService.getAllSuppliers) sData = await supplierService.getAllSuppliers();
        let sList = sData?.data?.data || sData?.data || sData || [];
        suppliers.value = Array.isArray(sList) ? sList : [];
    } catch (e) {
        console.error("Gagal memuat master supplier", e);
    }
};

// --- LOAD TRANSAKSI HUTANG (SERVER SIDE) ---
const loadData = async () => {
    loading.value = true;
    try {
        if (suppliers.value.length === 0) await loadSuppliers();

        // Format tanggal untuk dikirim ke API
        const startDate = dates.value?.[0] ? dates.value[0].toISOString().split('T')[0] : undefined;
        const endDate = dates.value?.[1] ? dates.value[1].toISOString().split('T')[0] : undefined;

        // Panggil API beserta parameter
        const response = await journalService.findAllByType('AP', {
            page: pagination.value.page,
            limit: pagination.value.limit,
            search: searchQuery.value,
            startDate: startDate,
            endDate: endDate
        });

        const resData = response || {};
        const dataList = resData?.data || [];
        
        if (resData?.summary) summary.value = resData.summary;
        if (resData?.meta) totalRecords.value = resData.meta.total;

        // Mapping Data dan Ekstrak DueDate jika ada
        rawDebts.value = dataList.map(item => {
            let finalSupplierName = item.supplier;
            if (item.supplierUuid && suppliers.value.length > 0) {
                const dbSupplier = suppliers.value.find(s => s.uuid === item.supplierUuid);
                if (dbSupplier) finalSupplierName = dbSupplier.name || dbSupplier.company || finalSupplierName;
            }

            // Mencari tanggal jatuh tempo di detailsMap jika ada
            const dueDateStr = item.detailsMap && item.detailsMap['due_date'] ? item.detailsMap['due_date'] : null;

            return { 
                ...item, 
                supplier: finalSupplierName,
                dueDate: dueDateStr
            };
        });

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Hutang', life: 3000 });
        rawDebts.value = [];
    } finally {
        loading.value = false;
    }
};

// --- EVENT HANDLERS ACTIONS ---
const onTransactionSaved = () => {
    loadData(); // Refresh data grid saat ada pembuatan hutang/pembayaran berhasil
}; 

const openPaymentModal = (debt) => {
    selectedDebt.value = debt;
    showPaymentModal.value = true;
};

const onPage = (event) => {
    pagination.value.page = event.page + 1;
    pagination.value.limit = event.rows;
    loadData();
};

let searchTimeout = null;
const onSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        pagination.value.page = 1; 
        loadData();
    }, 600); 
};

// Watcher untuk merespon perubahan tanggal
watch(dates, (newDates) => {
    if (!newDates || (newDates[0] && newDates[1])) {
        pagination.value.page = 1;
        loadData();
    }
});

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
const isOverdue = (dateString) => {
    if (!dateString) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(dateString) < today;
};

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                        <i class="pi pi-arrow-down-left text-lg"></i>
                    </div>
                    Hutang (AP)
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau kewajiban pembayaran ke supplier, DP, histori pembayaran, dan catat hutang manual.</p>
            </div>
            
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Catat Hutang Manual" icon="pi pi-plus" severity="danger" size="small" @click="showCreateModal = true" class="!rounded-xl shadow-sm hover:!bg-rose-700" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-rose-500">
                <div class="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0"><i class="pi pi-truck text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Pembelian Kredit</div><div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalHutang) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-check-circle text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Anda Bayarkan (DP+Cicil)</div><div class="text-xl font-black text-emerald-600">{{ formatCurrency(summary.totalTerbayar) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-orange-500">
                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><i class="pi pi-exclamation-circle text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Sisa Hutang (Belum Lunas)</div><div class="text-2xl font-black text-orange-600">{{ formatCurrency(summary.totalSisaHutang) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4" :class="{'border-l-4 border-l-red-500 bg-red-50/10': jatuhTempoCount > 0}">
                <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" :class="jatuhTempoCount > 0 ? 'bg-red-100 text-red-500' : 'bg-surface-100 text-surface-400'"><i class="pi pi-calendar-times text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Lewat Jatuh Tempo</div><div class="text-xl font-black" :class="jatuhTempoCount > 0 ? 'text-red-600' : 'text-surface-900'">{{ jatuhTempoCount }} Transaksi</div></div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div class="relative w-full sm:w-72">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                        <input v-model="searchQuery" @input="onSearch" type="text" placeholder="Cari Faktur atau Supplier..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-rose-500 focus:border-rose-500 transition-colors" />
                    </div>
                    
                    <div class="w-full sm:w-auto">
                        <DatePicker 
                            v-model="dates" 
                            selectionMode="range" 
                            :manualInput="false" 
                            dateFormat="dd/mm/yy" 
                            showIcon 
                            iconDisplay="input"
                            placeholder="Pilih Rentang Tanggal"
                            class="w-full sm:w-[260px] date-filter-custom"
                        />
                    </div>
                </div>

                <div class="text-xs font-medium text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200">
                    Menampilkan <span class="font-bold text-surface-900">{{ totalRecords }}</span> nota hutang
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="hutangList" 
                dataKey="code"
                :loading="loading"
                lazy
                paginator 
                :totalRecords="totalRecords"
                :rows="pagination.limit" 
                :rowsPerPageOptions="[15, 30, 50]"
                @page="onPage"
                stripedRows
                responsiveLayout="scroll"
                class="p-datatable-sm flex-1 text-sm border-none"
                :pt="{ headerRow: { class: 'bg-surface-50' } }"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 px-4 text-surface-500">
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-check-circle text-4xl text-emerald-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Semua Hutang Lunas / Kosong</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Saat ini tidak ada kewajiban/hutang ke supplier yang ditemukan berdasarkan pencarian/tanggal.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Informasi Tagihan" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block w-max border border-rose-100 shadow-sm" v-tooltip.top="'Nomor Faktur / Invoice'">
                                <i class="pi pi-receipt text-[10px] mr-1"></i> {{ data.invoiceCode || data.code }}
                            </div>
                            
                            <div class="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> Dibuat: {{ formatDate(data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="supplier" header="Supplier / Vendor" sortable style="min-width: 12rem">
                     <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 uppercase">
                                {{ data.supplier.substring(0, 1) }}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-surface-800">{{ data.supplier }}</span>
                                <div v-if="data.supplierUuid" class="flex items-center gap-1 mt-0.5" v-tooltip.bottom="'Tersambung ke Database Supplier'">
                                    <i class="pi pi-database text-[8px] text-rose-500"></i> <span class="text-[9px] text-surface-400">Tersinkronisasi</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="dueDate" header="Status / Jatuh Tempo" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex flex-col items-start gap-1">
                            <Tag v-if="data.remaining <= 0.01" value="LUNAS" severity="success" class="!text-[9px] !font-bold !px-2" rounded />
                            <Tag v-else-if="isOverdue(data.dueDate)" value="Lewat Waktu" severity="danger" class="!text-[9px] !font-bold !px-2" rounded />
                            <Tag v-else value="Belum Lunas" severity="warning" class="!text-[9px] !font-bold !px-2" rounded />
                            
                            <span v-if="data.remaining > 0.01" class="text-xs font-medium" :class="isOverdue(data.dueDate) ? 'text-red-600 font-bold' : 'text-surface-600'">
                                {{ data.dueDate ? formatDate(data.dueDate) : 'Tidak diset' }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Rincian Nominal" style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col text-xs space-y-1 w-full max-w-[180px]">
                            <div class="flex justify-between text-surface-600">
                                <span>Total Hutang:</span>
                                <span class="font-semibold">{{ formatCurrency(data.total) }}</span>
                            </div>
                            <div class="flex justify-between text-emerald-600">
                                <span>Telah Dibayar:</span>
                                <span>- {{ formatCurrency(data.paid) }}</span>
                            </div>
                            <div class="border-t border-dashed border-surface-200 pt-1 flex justify-between items-center">
                                <span class="font-bold text-surface-800">Sisa Kewajiban:</span>
                                <span class="font-black text-sm text-orange-600">{{ formatCurrency(data.remaining) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column alignFrozen="right" class="text-center" style="width: 6rem">
                    <template #body="{ data }">
                        <Button v-if="data.remaining > 0.01" label="Bayar" icon="pi pi-wallet" severity="danger" size="small" class="!rounded-xl !text-xs font-bold shadow-sm !px-3" @click="openPaymentModal(data)" />
                        <i v-else class="pi pi-check-circle text-emerald-500 text-xl" v-tooltip="'Lunas'"></i>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-rose-50/30 border-y border-rose-100">
                        <div class="w-full max-w-4xl bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                            <h5 class="text-sm font-bold text-rose-800 mb-3 flex items-center justify-between gap-2 border-b border-surface-100 pb-2">
                                <div class="flex items-center gap-2"><i class="pi pi-history"></i> Riwayat Pembayaran / Cicilan Anda</div>
                                <span class="text-xs font-mono text-surface-400">{{ slotProps.data.invoiceCode }}</span>
                            </h5>
                            
                            <div class="space-y-2">
                                <div v-if="slotProps.data.dp > 0" class="p-3 bg-surface-50 border border-surface-200 rounded-lg flex justify-between items-center shadow-sm">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><i class="pi pi-check text-xs font-bold"></i></div>
                                        <div>
                                            <div class="text-xs font-bold text-surface-800">Uang Muka (DP) Awal</div>
                                            <div class="text-[10px] text-surface-500 mt-0.5">{{ formatDate(slotProps.data.date) }}</div>
                                        </div>
                                    </div>
                                    <div class="font-black text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</div>
                                </div>

                                <div v-if="!slotProps.data.payments?.length && slotProps.data.dp <= 0" class="p-4 text-center text-surface-500 bg-surface-50 rounded-lg border border-dashed border-surface-200 text-xs italic">
                                    Belum ada riwayat pembayaran keluar untuk tagihan ini.
                                </div>

                                <div v-else-if="slotProps.data.payments?.length > 0" class="space-y-2 mt-2">
                                    <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-3 bg-white border border-rose-100 rounded-lg flex justify-between items-center shadow-sm">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center"><i class="pi pi-arrow-up-right text-xs font-bold"></i></div>
                                            <div class="flex flex-col">
                                                <div class="text-xs font-bold text-surface-800 font-mono">{{ pay.code }}</div>
                                                <div class="text-[10px] text-surface-500 flex items-center gap-2 mt-0.5">
                                                    <span>{{ formatDate(pay.date) }}</span>
                                                    <span class="font-mono bg-surface-200 px-1.5 py-0.5 rounded">{{ pay.method }}</span>
                                                </div>
                                                <div v-if="pay.notes" class="text-[10px] text-surface-500 mt-1 italic border-l-2 border-rose-200 pl-2">"{{ pay.notes }}"</div>
                                            </div>
                                        </div>
                                        <div class="font-black text-rose-600">- {{ formatCurrency(pay.amount) }}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="mt-4 pt-3 border-t border-dashed border-surface-200 flex justify-between items-center bg-orange-50 p-2 rounded">
                                <span class="text-xs font-bold text-surface-700">TOTAL KEKURANGAN (HUTANG ANDA)</span>
                                <span class="font-black text-orange-600 text-lg">{{ formatCurrency(slotProps.data.remaining) }}</span>
                            </div>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>

        <ApCreateModal v-model:visible="showCreateModal" @saved="onTransactionSaved" />
        <PaymentApModal v-model:visible="showPaymentModal" :payable="selectedDebt" @saved="onTransactionSaved" />
        
    </div>
</template>

<style scoped>
.p-datatable .p-datatable-tbody > tr.p-highlight {
    background-color: #fff1f2 !important; /* Tema rose muda saat row di-expand */
}

/* Memperhalus tampilan input pada DatePicker PrimeVue */
:deep(.date-filter-custom .p-inputtext) {
    border-radius: 0.75rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    font-size: 0.875rem !important;
}
</style>