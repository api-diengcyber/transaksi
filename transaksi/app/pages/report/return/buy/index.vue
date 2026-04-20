<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useJournalService } from '~/composables/useJournalService';
import { useSupplierService } from '~/composables/useSupplierService'; // Gunakan Supplier Service

const journalService = useJournalService();
const supplierService = useSupplierService(); 
const toast = useToast();

const returns = ref([]); 
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
    totalNilaiRetur: 0,
    totalItemRetur: 0
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

// --- LOAD TRANSAKSI RETURN PEMBELIAN ---
const loadData = async () => {
    loading.value = true;
    try {
        if (suppliers.value.length === 0) await loadSuppliers();

        // Format tanggal untuk dikirim ke API
        const startDate = dates.value?.[0] ? dates.value[0].toISOString().split('T')[0] : undefined;
        const endDate = dates.value?.[1] ? dates.value[1].toISOString().split('T')[0] : undefined;

        // Panggil API beserta parameter
        const response = await journalService.findAllByType('RET_BUY', {
            page: pagination.value.page,
            limit: pagination.value.limit,
            search: searchQuery.value,
            startDate: startDate,
            endDate: endDate
        });

        const resData = response || {};
        const dataList = resData?.data || [];
        
        // Update summary & paginasi dari backend
        if (resData?.summary) summary.value = resData.summary;
        if (resData?.meta) totalRecords.value = resData.meta.total;

        // Cocokkan ID Supplier
        returns.value = dataList.map(item => {
            let finalSupplierName = item.supplier;
            if (item.supplierUuid && suppliers.value.length > 0) {
                const dbSupplier = suppliers.value.find(s => s.uuid === item.supplierUuid);
                if (dbSupplier) finalSupplierName = dbSupplier.name || dbSupplier.company || finalSupplierName;
            }
            return { ...item, supplier: finalSupplierName };
        });

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat Laporan Return Pembelian', life: 3000 });
        returns.value = [];
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
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <i class="pi pi-replay text-lg"></i>
                    </div>
                    Laporan Return Pembelian
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau rincian barang yang dikembalikan ke supplier/vendor.</p>
            </div>
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-indigo-500">
                <div class="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0"><i class="pi pi-wallet text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Retur</div><div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalNilaiRetur) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-rose-500">
                <div class="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0"><i class="pi pi-box text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Qty Barang Retur</div><div class="text-xl font-black text-rose-600">{{ summary.totalItemRetur }} Item</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0"><i class="pi pi-file text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Nota Retur</div><div class="text-xl font-black text-surface-900">{{ totalRecords }} Transaksi</div></div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div class="relative w-full sm:w-72">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                        <input v-model="searchQuery" @input="onSearch" type="text" placeholder="Cari Retur/Invoice/Supplier..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
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
                    Menampilkan <span class="font-bold text-surface-900">{{ totalRecords }}</span> nota retur
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="returns" 
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
                        <h3 class="text-lg font-bold text-surface-700">Belum Ada Transaksi</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Data return pembelian belum tersedia atau tidak ditemukan.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No Retur" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md inline-block w-max border border-indigo-100 shadow-sm">
                                <i class="pi pi-replay text-[10px] mr-1"></i> {{ data.code }}
                            </div>
                            <div class="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> {{ formatDate(data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="referenceCode" header="Referensi Faktur" style="min-width: 12rem">
                    <template #body="{ data }">
                        <div class="font-mono text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded inline-block border border-primary-100" v-if="data.referenceCode">
                            <i class="pi pi-receipt text-[10px] mr-1"></i> {{ data.referenceCode }}
                        </div>
                        <span v-else class="text-surface-400 text-xs italic">Tanpa Referensi</span>
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

                <Column header="Total Pengembalian" alignFrozen="right" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-black text-sm text-indigo-600">{{ formatCurrency(data.total) }}</div>
                        <div class="text-[10px] text-surface-500 mt-0.5">{{ data.items ? data.items.length : 0 }} Macam Barang</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-100/50 border-y border-surface-200">
                        <div class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm w-full max-w-4xl">
                            <div class="flex justify-between items-center mb-3 border-b border-surface-100 pb-2">
                                <h5 class="text-sm font-bold text-indigo-800 flex items-center gap-2 m-0">
                                    <i class="pi pi-box"></i> Rincian Barang Diretur
                                </h5>
                                <span class="text-xs font-mono font-bold text-surface-400">{{ slotProps.data.code }}</span>
                            </div>

                            <div v-if="!slotProps.data.items || slotProps.data.items.length === 0" class="p-4 text-center text-surface-400 italic text-xs">
                                Rincian barang tidak ditemukan.
                            </div>

                            <div v-else class="overflow-x-auto rounded-lg border border-surface-200">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-surface-50 text-surface-600 border-b border-surface-200 uppercase text-[10px]">
                                        <tr>
                                            <th class="px-4 py-2 font-bold w-12 text-center">No</th>
                                            <th class="px-4 py-2 font-bold">Nama Barang</th>
                                            <th class="px-4 py-2 font-bold text-right">Nilai / Harga</th>
                                            <th class="px-4 py-2 font-bold text-center">Qty Retur</th>
                                            <th class="px-4 py-2 font-bold text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-surface-100">
                                        <tr v-for="(item, index) in slotProps.data.items" :key="index">
                                            <td class="px-4 py-2 text-center text-surface-400">{{ index + 1 }}</td>
                                            <td class="px-4 py-2 font-semibold text-surface-800">{{ item.name }}</td>
                                            <td class="px-4 py-2 text-right">{{ formatCurrency(item.price) }}</td>
                                            <td class="px-4 py-2 text-center"><span class="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200">{{ item.qty }}</span></td>
                                            <td class="px-4 py-2 text-right font-bold text-indigo-600">{{ formatCurrency(item.subtotal) }}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot class="bg-surface-50 border-t border-surface-200 font-bold">
                                        <tr>
                                            <td colspan="4" class="px-4 py-3 text-right uppercase text-[10px] text-surface-500">Total Pengembalian</td>
                                            <td class="px-4 py-3 text-right text-sm text-indigo-700">{{ formatCurrency(slotProps.data.total) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            
                            <div v-if="slotProps.data.notes" class="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-2">
                                <i class="pi pi-info-circle text-indigo-500 mt-0.5"></i>
                                <div>
                                    <span class="block text-[10px] font-bold uppercase text-indigo-700 mb-0.5">Catatan / Alasan Retur:</span>
                                    <p class="text-xs text-indigo-900 m-0">{{ slotProps.data.notes }}</p>
                                </div>
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
    background-color: #eef2ff !important; /* Tema indigo muda saat row di-expand */
}

/* Memperhalus tampilan input pada DatePicker PrimeVue */
:deep(.date-filter-custom .p-inputtext) {
    border-radius: 0.75rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    font-size: 0.875rem !important;
}
</style>