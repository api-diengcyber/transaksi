<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useMemberService } from '~/composables/useMemberService';
import { useRouter } from 'vue-router';

const router = useRouter();

const journalService = useJournalService();
const toast = useToast();

const sales = ref([]); 
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
    totalPenjualan: 0,
    totalTunai: 0,
    totalKredit: 0,
    totalItemTerjual: 0
});

// --- LOAD TRANSAKSI PENJUALAN ---
const loadData = async () => {
    loading.value = true;
    try {
        // Format tanggal untuk dikirim ke API
        const startDate = dates.value?.[0] ? dates.value[0].toISOString().split('T')[0] : undefined;
        const endDate = dates.value?.[1] ? dates.value[1].toISOString().split('T')[0] : undefined;

        // Panggil API beserta parameter paginasi, pencarian, dan tanggal
        const response = await journalService.findAllByType('SALE', {
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

        sales.value = dataList.map(item => {
            return { ...item };
        });

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat Data Penjualan', life: 3000 });
        sales.value = [];
    } finally {
        loading.value = false;
    }
};

// --- EVENT HANDLERS ---
const onPage = (event) => {
    // Event dari PrimeVue: event.page dimulai dari 0
    pagination.value.page = event.page + 1;
    pagination.value.limit = event.rows;
    loadData();
};

let searchTimeout = null;
const onSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        pagination.value.page = 1; // Reset kembali ke halaman 1 saat pencarian
        loadData();
    }, 600); // Debounce 600ms
};

// [BARU] Fungsi Navigasi ke Halaman Cetak di Tab Baru
const printReceipt = (saleData) => {
    // Memastikan UUID jurnal tersedia, jika tidak fallback ke code
    const targetId = saleData.uuid || saleData.code;
    
    if (targetId) {
        // Mendapatkan URL lengkap berdasarkan rute Nuxt/Vue
        const url = router.resolve(`/receipt/${targetId}`).href;
        window.open(url, '_blank');
    } else {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'ID Transaksi tidak ditemukan', life: 3000 });
    }
};

// Watcher untuk merespon perubahan tanggal
watch(dates, (newDates) => {
    // Hanya refresh jika kedua tanggal (awal & akhir) sudah dipilih, atau input dikosongkan
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
                    <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <i class="pi pi-shopping-cart text-lg"></i>
                    </div>
                    Penjualan
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau rincian barang, piutang, dan histori retur untuk setiap faktur penjualan.</p>
            </div>
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Buat penjualan" icon="pi pi-plus" severity="primary" size="small" class="!rounded-xl shadow-sm" @click="router.push('/sale/create')"  />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-blue-500">
                <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><i class="pi pi-money-bill text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Omset Penjualan</div><div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalPenjualan) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-wallet text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Pembayaran Tunai</div><div class="text-xl font-black text-emerald-600">{{ formatCurrency(summary.totalTunai) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><i class="pi pi-credit-card text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Penjualan Kredit (Piutang)</div><div class="text-xl font-black text-orange-600">{{ formatCurrency(summary.totalKredit) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0"><i class="pi pi-box text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Qty Barang Keluar</div><div class="text-xl font-black text-surface-900">{{ summary.totalItemTerjual }} Item</div></div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div class="relative w-full sm:w-72">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                        <input v-model="searchQuery" @input="onSearch" type="text" placeholder="Cari Faktur atau Pelanggan..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-blue-500 focus:border-blue-500 transition-colors" />
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
                    Menampilkan <span class="font-bold text-surface-900">{{ totalRecords }}</span> nota penjualan
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="sales" 
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
                        <p class="text-sm mt-1 max-w-sm text-center">Data penjualan belum tersedia atau tidak ditemukan berdasarkan pencarian/tanggal.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No Faktur / Transaksi" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md inline-block w-max border border-primary-100 shadow-sm" v-tooltip.top="'Nomor Faktur / Invoice'">
                                <i class="pi pi-receipt text-[10px] mr-1"></i> {{ data.invoiceCode || data.code }}
                            </div>
                            
                            <div v-if="data.invoiceCode && data.invoiceCode !== data.code" class="text-[10px] text-surface-400 font-mono mt-1 flex items-center gap-1">
                                <i class="pi pi-database text-[9px]"></i> Sys: {{ data.code }}
                            </div>
                            
                            <div class="text-[10px] text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> {{ formatDate(data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="member" header="Pelanggan / Member" sortable style="min-width: 12rem">
                     <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 uppercase">
                                {{ data.member.substring(0, 1) }}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-surface-800">{{ data.member }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="isCredit" header="Metode Bayar" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag v-if="data.isCredit" value="Hutang / Kredit" severity="warning" class="!text-[9px] !font-bold !px-2" rounded />
                        <Tag v-else value="Tunai / Lunas" severity="success" class="!text-[9px] !font-bold !px-2" rounded />
                        
                        <div v-if="data.paymentMethod && data.paymentMethod !== 'CASH' && data.paymentMethod !== 'CREDIT'" class="text-[10px] text-surface-500 mt-1 font-mono">
                            Via: {{ data.paymentMethod }}
                        </div>
                    </template>
                </Column>
                
                <Column header="Total Transaksi" alignFrozen="right" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-black text-sm text-surface-900">{{ formatCurrency(data.total) }}</div>
                        <div class="text-[10px] text-surface-500 mt-0.5">{{ data.items ? data.items.length : 0 }} Macam Barang</div>
                    </template>
                </Column>

                <Column alignFrozen="right" style="width: 4rem; text-align: center">
                    <template #body="{ data }">
                        <Button icon="pi pi-print" severity="secondary" rounded text v-tooltip.top="'Cetak Struk'" @click="printReceipt(data)" class="hover:bg-surface-100 hover:text-blue-600 transition-colors" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-100/50 border-y border-surface-200 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        
                        <div class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm col-span-1 xl:col-span-2">
                            <div class="flex justify-between items-center mb-3 border-b border-surface-100 pb-2">
                                <h5 class="text-sm font-bold text-blue-800 flex items-center gap-2 m-0">
                                    <i class="pi pi-shopping-bag"></i> 1. Rincian Barang Terjual
                                </h5>
                                <div class="flex items-center gap-3">
                                    <Button icon="pi pi-print" label="Cetak Struk" size="small" severity="secondary" outlined @click="printReceipt(slotProps.data)" class="!text-[10px] !py-1 !px-2 !rounded-lg" />
                                    <span class="text-xs font-mono font-bold text-surface-400">FAKTUR: {{ slotProps.data.code }}</span>
                                </div>
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
                                            <th class="px-4 py-2 font-bold text-right">Harga Jual</th>
                                            <th class="px-4 py-2 font-bold text-center">Qty</th>
                                            <th class="px-4 py-2 font-bold text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-surface-100">
                                        <tr v-for="(item, index) in slotProps.data.items" :key="index">
                                            <td class="px-4 py-2 text-center text-surface-400">{{ index + 1 }}</td>
                                            <td class="px-4 py-2 font-semibold text-surface-800">{{ item.name }}</td>
                                            <td class="px-4 py-2 text-right">{{ formatCurrency(item.price) }}</td>
                                            <td class="px-4 py-2 text-center"><span class="bg-surface-100 px-2 py-0.5 rounded border">{{ item.qty }}</span></td>
                                            <td class="px-4 py-2 text-right font-bold text-blue-600">{{ formatCurrency(item.subtotal) }}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot class="bg-surface-50 border-t border-surface-200 font-bold">
                                        <tr>
                                            <td colspan="4" class="px-4 py-3 text-right uppercase text-[10px] text-surface-500">Grand Total</td>
                                            <td class="px-4 py-3 text-right text-sm text-surface-900">{{ formatCurrency(slotProps.data.total) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div v-if="slotProps.data.isCredit" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                            <div class="flex justify-between items-center mb-3">
                                <h5 class="text-sm font-bold text-emerald-800 flex items-center gap-2">
                                    <i class="pi pi-wallet"></i> 2. Histori Piutang & Pembayaran
                                </h5>
                                <Tag :value="slotProps.data.remaining <= 0.01 ? 'LUNAS' : 'BELUM LUNAS'" :severity="slotProps.data.remaining <= 0.01 ? 'success' : 'danger'" class="!text-[9px]" />
                            </div>

                            <div class="space-y-2">
                                <div v-if="slotProps.data.dp > 0" class="p-2 border border-surface-100 rounded-lg flex justify-between items-center bg-surface-50">
                                    <div class="text-xs text-surface-600"><i class="pi pi-check-circle text-emerald-500 mr-1"></i> DP Awal (Tunai)</div>
                                    <div class="font-bold text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</div>
                                </div>
                                <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-2 border border-surface-100 rounded-lg flex justify-between items-center bg-surface-50">
                                    <div class="flex flex-col">
                                        <div class="text-xs font-bold text-surface-800"><i class="pi pi-arrow-down-left text-emerald-500 mr-1 text-[10px]"></i> {{ pay.code }}</div>
                                        <div class="text-[10px] text-surface-500 mt-0.5 ml-4">{{ formatDate(pay.date) }}</div>
                                    </div>
                                    <div class="font-bold text-emerald-600">+ {{ formatCurrency(pay.amount) }}</div>
                                </div>
                            </div>
                            
                            <div class="mt-3 pt-3 border-t border-dashed border-surface-200 flex justify-between items-center">
                                <span class="text-xs font-bold text-surface-600">Sisa Tagihan Pelanggan</span>
                                <span class="font-black text-rose-600">{{ formatCurrency(slotProps.data.remaining) }}</span>
                            </div>
                        </div>

                        <div v-if="slotProps.data.returns && slotProps.data.returns.length > 0" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm" :class="{'xl:col-span-2': !slotProps.data.isCredit}">
                            <h5 class="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
                                <i class="pi pi-replay"></i> {{ slotProps.data.isCredit ? '3.' : '2.' }} Histori Retur Penjualan
                            </h5>
                            
                            <div class="space-y-2">
                                <div v-for="(ret, idx) in slotProps.data.returns" :key="idx" class="p-2 border border-orange-100 rounded-lg flex justify-between items-center bg-orange-50/50">
                                    <div class="flex flex-col">
                                        <div class="text-xs font-bold text-surface-800"><i class="pi pi-arrow-up-right text-orange-500 mr-1 text-[10px]"></i> {{ ret.code }}</div>
                                        <div class="text-[10px] text-surface-500 mt-0.5 ml-4">{{ formatDate(ret.date) }}</div>
                                    </div>
                                    <div class="font-bold text-orange-600">Refund: {{ formatCurrency(ret.amount) }}</div>
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
    background-color: #f0f9ff !important; /* Tema biru muda saat row di-expand */
}

/* Memperhalus tampilan input pada DatePicker PrimeVue */
:deep(.date-filter-custom .p-inputtext) {
    border-radius: 0.75rem !important;
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    font-size: 0.875rem !important;
}
</style>