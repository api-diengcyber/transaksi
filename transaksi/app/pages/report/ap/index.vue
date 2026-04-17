<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useSupplierService } from '~/composables/useSupplierService';

const journalService = useJournalService();
const supplierService = useSupplierService();
const toast = useToast();

const payables = ref([]);
const suppliers = ref([]);
const loading = ref(true);
const expandedRows = ref({});
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- SUMMARY ---
const summary = computed(() => {
    let totalAp = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    payables.value.forEach(p => {
        totalAp += p.total;
        totalPaid += p.paid;
        totalRemaining += p.remaining;
    });
    return { totalAp, totalPaid, totalRemaining };
});

const loadMasterSuppliers = async () => {
    try {
        const res = await supplierService.getAllSuppliers();
        suppliers.value = res?.data?.data || res?.data || res || [];
    } catch (e) {}
};

const loadData = async () => {
    loading.value = true;
    try {
        if (suppliers.value.length === 0) await loadMasterSuppliers();
        const response = await journalService.findAllByType('AP');
        const dataList = response?.data?.data || response?.data || response || [];
        
        payables.value = dataList.map(item => {
            let finalName = item.supplier;
            if (item.supplierUuid) {
                const dbSup = suppliers.value.find(s => s.uuid === item.supplierUuid);
                if (dbSup) finalName = dbSup.name || dbSup.username || finalName;
            }
            return { ...item, supplier: finalName };
        });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan hutang', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const formatDate = (d) => (!d) ? '-' : new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-rose-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                        <i class="pi pi-truck text-lg"></i>
                    </div>
                    Laporan Hutang Supplier
                </h1>
                <p class="text-sm text-surface-500 mt-1">Rekapitulasi kewajiban pembayaran ke vendor dan histori cicilan hutang.</p>
            </div>
            <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="bg-white" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Seluruh Hutang</div>
                <div class="text-2xl font-black text-rose-700">{{ formatCurrency(summary.totalAp) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 border-l-4 border-l-blue-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Telah Dibayar</div>
                <div class="text-2xl font-black text-blue-600">{{ formatCurrency(summary.totalPaid) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-orange-200 border-l-4 border-l-orange-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Sisa Hutang (Netto)</div>
                <div class="text-2xl font-black text-orange-600">{{ formatCurrency(summary.totalRemaining) }}</div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-0/50">
                <div class="relative w-full max-w-md">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Kode atau Nama Supplier..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-rose-500 transition-colors" />
                </div>
            </div>

            <DataTable v-model:expandedRows="expandedRows" :value="payables" dataKey="invoiceCode" :loading="loading" paginator :rows="10" stripedRows class="p-datatable-sm flex-1 text-sm border-none" :filters="filters">
                <Column expander style="width: 3rem" />
                
                <Column field="invoiceCode" header="Nomor Hutang" sortable>
                    <template #body="{ data }">
                        <div class="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block">{{ data.invoiceCode }}</div>
                        <div class="text-[10px] text-surface-400 mt-1">{{ data.type === 'BUY_CREDIT' ? 'Pembelian' : 'Input Manual' }}</div>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier / Vendor" sortable>
                    <template #body="{ data }">
                        <span class="font-bold text-surface-800">{{ data.supplier }}</span>
                        <div class="text-[10px] text-surface-500">Jatuh Tempo: {{ data.dueDate ? formatDate(data.dueDate) : '-' }}</div>
                    </template>
                </Column>

                <Column header="Status">
                    <template #body="{ data }">
                        <Tag :value="data.isPaidOff ? 'LUNAS' : 'BELUM LUNAS'" :severity="data.isPaidOff ? 'success' : 'danger'" rounded class="!text-[9px]" />
                    </template>
                </Column>

                <Column header="Total & Sisa" alignFrozen="right" class="text-right">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900">{{ formatCurrency(data.total) }}</div>
                        <div class="font-black text-rose-600 text-xs">Sisa: {{ formatCurrency(data.remaining) }}</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-rose-50/30 border-y border-rose-100">
                        <h5 class="text-sm font-bold text-rose-800 mb-3 flex items-center gap-2"><i class="pi pi-history"></i> Riwayat Pembayaran Keluar</h5>
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div v-if="slotProps.data.dp > 0" class="p-3 bg-white border border-rose-100 rounded-lg flex justify-between shadow-sm">
                                <span class="text-xs">Uang Muka (DP) / Pembayaran Awal</span>
                                <span class="font-bold text-blue-600">{{ formatCurrency(slotProps.data.dp) }}</span>
                            </div>

                            <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-3 bg-white border border-surface-200 rounded-lg flex justify-between shadow-sm">
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold">{{ pay.invoiceCode }}</span>
                                    <span class="text-[10px] text-surface-400">{{ formatDate(pay.date) }}</span>
                                </div>
                                <span class="font-bold text-blue-600">- {{ formatCurrency(pay.amount) }}</span>
                            </div>
                        </div>

                        <div v-if="slotProps.data.payments.length === 0 && slotProps.data.dp === 0" class="p-4 text-center text-surface-400 italic text-xs">Belum ada histori pembayaran keluar.</div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>