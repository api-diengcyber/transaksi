<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useJournalService } from '~/composables/useJournalService';
import { useSupplierService } from '~/composables/useSupplierService'; // Gunakan Supplier Service

const journalService = useJournalService();
const supplierService = useSupplierService(); 
const toast = useToast();

const apList = ref([]); 
const suppliers = ref([]); 
const loading = ref(true);
const expandedRows = ref({}); 

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

// --- LOAD TRANSAKSI HUTANG ---
const loadData = async () => {
    loading.value = true;
    try {
        if (suppliers.value.length === 0) await loadSuppliers();

        // Format tanggal untuk dikirim ke API
        const startDate = dates.value?.[0] ? dates.value[0].toISOString().split('T')[0] : undefined;
        const endDate = dates.value?.[1] ? dates.value[1].toISOString().split('T')[0] : undefined;

        // Panggil API beserta parameter paginasi, pencarian, dan tanggal
        const response = await journalService.findAllByType('AP', {
            page: pagination.value.page,
            limit: pagination.value.limit,
            search: searchQuery.value,
            startDate: startDate,
            endDate: endDate
        });

        const resData = response || {};
        const dataList = resData?.data || [];
        
        // Update summary dari backend
        if (resData?.summary) {
            summary.value = resData.summary;
        }

        // Update total info paginasi dari backend
        if (resData?.meta) {
            totalRecords.value = resData.meta.total;
        }

        // Cocokkan ID Supplier
        apList.value = dataList.map(item => {
            let finalSupplierName = item.supplier;
            if (item.supplierUuid && suppliers.value.length > 0) {
                const dbSupplier = suppliers.value.find(s => s.uuid === item.supplierUuid);
                if (dbSupplier) finalSupplierName = dbSupplier.name || dbSupplier.company || finalSupplierName;
            }
            return { ...item, supplier: finalSupplierName };
        });

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat Laporan Hutang', life: 3000 });
        apList.value = [];
    } finally {
        loading.value = false;
    }
};

// --- EVENT HANDLERS ---
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
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                        <i class="pi pi-credit-card text-lg"></i>
                    </div>
                    Laporan Hutang (Account Payable)
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau sisa hutang ke supplier, DP, dan histori pembayaran cicilan Anda.</p>
            </div>
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-rose-500">
                <div class="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0"><i class="pi pi-money-bill text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Pembelian Kredit</div><div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalHutang) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-emerald-500">
                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-check-circle text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Anda Bayarkan (DP+Cicil)</div><div class="text-xl font-black text-emerald-600">{{ formatCurrency(summary.totalTerbayar) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-orange-500">
                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><i class="pi pi-exclamation-circle text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Sisa Hutang (Belum Lunas)</div><div class="text-xl font-black text-orange-600">{{ formatCurrency(summary.totalSisaHutang) }}</div></div>
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
                :value="apList" 
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
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-inbox text-4xl text-surface-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Belum Ada Transaksi Hutang</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Data hutang tidak ditemukan berdasarkan pencarian/tanggal.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No Faktur / Transaksi" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block w-max border border-rose-100 shadow-sm" v-tooltip.top="'Nomor Faktur / Invoice'">
                                <i class="pi pi-receipt text-[10px] mr-1"></i> {{ data.invoiceCode || data.code }}
                            </div>
                            
                            <div class="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> {{ formatDate(data.date) }}
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
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="total" header="Total Transaksi" alignFrozen="right" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-bold text-sm text-surface-900">{{ formatCurrency(data.total) }}</div>
                    </template>
                </Column>

                <Column field="paid" header="Terbayar (DP+Cicil)" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-bold text-sm text-emerald-600">{{ formatCurrency(data.paid) }}</div>
                    </template>
                </Column>

                <Column field="remaining" header="Sisa Tagihan (Hutang)" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-black text-sm text-orange-600">{{ formatCurrency(data.remaining) }}</div>
                        <Tag v-if="data.remaining <= 0.01" value="LUNAS" severity="success" class="!text-[9px] mt-1" />
                        <Tag v-else value="BELUM LUNAS" severity="danger" class="!text-[9px] mt-1" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-100/50 border-y border-surface-200 w-full max-w-4xl">
                        <div class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                            <div class="flex justify-between items-center mb-3 border-b border-surface-100 pb-2">
                                <h5 class="text-sm font-bold text-emerald-800 flex items-center gap-2 m-0">
                                    <i class="pi pi-wallet"></i> Histori Pembayaran & Cicilan Anda
                                </h5>
                                <span class="text-xs font-mono font-bold text-surface-400">{{ slotProps.data.invoiceCode }}</span>
                            </div>

                            <div class="space-y-2">
                                <div v-if="slotProps.data.dp > 0" class="p-3 border border-surface-100 rounded-lg flex justify-between items-center bg-surface-50">
                                    <div class="flex flex-col">
                                        <div class="text-xs font-bold text-surface-800"><i class="pi pi-check-circle text-emerald-500 mr-1"></i> Down Payment (DP Awal)</div>
                                    </div>
                                    <div class="font-bold text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</div>
                                </div>
                                <div v-else class="p-2 border border-surface-100 rounded-lg text-center bg-surface-50">
                                    <span class="text-[10px] text-surface-400 italic">Tidak ada DP Awal</span>
                                </div>

                                <div v-if="slotProps.data.payments && slotProps.data.payments.length > 0">
                                    <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-3 border border-emerald-100 rounded-lg flex justify-between items-center bg-emerald-50/30 mb-2">
                                        <div class="flex flex-col">
                                            <div class="text-xs font-bold text-surface-800"><i class="pi pi-arrow-up-right text-emerald-500 mr-1 text-[10px]"></i> {{ pay.code }}</div>
                                            <div class="text-[10px] text-surface-500 mt-0.5 ml-4">{{ formatDate(pay.date) }} <span class="ml-2 font-mono bg-surface-200 px-1 rounded">{{ pay.method }}</span></div>
                                            <div v-if="pay.notes" class="text-[10px] text-surface-500 ml-4 mt-1 italic">"{{ pay.notes }}"</div>
                                        </div>
                                        <div class="font-bold text-emerald-600">+ {{ formatCurrency(pay.amount) }}</div>
                                    </div>
                                </div>
                                <div v-else class="p-2 text-center">
                                    <span class="text-[10px] text-surface-400 italic">Belum ada cicilan/pembayaran yang Anda bayarkan setelah DP.</span>
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