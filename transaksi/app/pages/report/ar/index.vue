<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useMemberService } from '~/composables/useMemberService';

const journalService = useJournalService();
const memberService = useMemberService();
const toast = useToast();

const receivables = ref([]);
const members = ref([]);
const loading = ref(true);
const expandedRows = ref({});
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- SUMMARY ---
const summary = computed(() => {
    let totalAr = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    receivables.value.forEach(r => {
        totalAr += r.total;
        totalPaid += r.paid;
        totalRemaining += r.remaining;
    });
    return { totalAr, totalPaid, totalRemaining };
});

const loadMasterMembers = async () => {
    try {
        const res = await memberService.getAllMembers();
        members.value = res?.data?.data || res?.data || res || [];
    } catch (e) {}
};

const loadData = async () => {
    loading.value = true;
    try {
        if (members.value.length === 0) await loadMasterMembers();
        const response = await journalService.findAllByType('AR');
        const dataList = response?.data?.data || response?.data || response || [];
        
        receivables.value = dataList.map(item => {
            let finalName = item.member;
            if (item.memberUuid) {
                const dbMem = members.value.find(m => m.uuid === item.memberUuid);
                if (dbMem) finalName = dbMem.name || dbMem.username || finalName;
            }
            return { ...item, member: finalName };
        });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan piutang', life: 3000 });
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
                <h1 class="text-2xl font-bold text-indigo-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <i class="pi pi-users text-lg"></i>
                    </div>
                    Laporan Piutang Pelanggan
                </h1>
                <p class="text-sm text-surface-500 mt-1">Rekapitulasi tagihan belum tertagih dan histori cicilan pelanggan.</p>
            </div>
            <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="bg-white" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-indigo-200 border-l-4 border-l-indigo-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Seluruh Piutang</div>
                <div class="text-2xl font-black text-indigo-700">{{ formatCurrency(summary.totalAr) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Telah Tertagih</div>
                <div class="text-2xl font-black text-emerald-600">{{ formatCurrency(summary.totalPaid) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-rose-200 border-l-4 border-l-rose-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Sisa Piutang (Netto)</div>
                <div class="text-2xl font-black text-rose-600">{{ formatCurrency(summary.totalRemaining) }}</div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-0/50">
                <div class="relative w-full max-w-md">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Kode atau Nama Pelanggan..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-indigo-500 transition-colors" />
                </div>
            </div>

            <DataTable v-model:expandedRows="expandedRows" :value="receivables" dataKey="invoiceCode" :loading="loading" paginator :rows="10" stripedRows class="p-datatable-sm flex-1 text-sm border-none" :filters="filters">
                <Column expander style="width: 3rem" />
                
                <Column field="invoiceCode" header="Nomor Tagihan" sortable>
                    <template #body="{ data }">
                        <div class="font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">{{ data.invoiceCode }}</div>
                        <div class="text-[10px] text-surface-400 mt-1">{{ data.type === 'SALE_CREDIT' ? 'Penjualan' : 'Input Manual' }}</div>
                    </template>
                </Column>

                <Column field="member" header="Pelanggan" sortable>
                    <template #body="{ data }">
                        <span class="font-bold text-surface-800">{{ data.member }}</span>
                        <div class="text-[10px] text-surface-500">Jatuh Tempo: {{ data.dueDate ? formatDate(data.dueDate) : '-' }}</div>
                    </template>
                </Column>

                <Column header="Status">
                    <template #body="{ data }">
                        <Tag :value="data.isPaidOff ? 'LUNAS' : 'AKTIF'" :severity="data.isPaidOff ? 'success' : 'danger'" rounded class="!text-[9px]" />
                    </template>
                </Column>

                <Column header="Total & Sisa" alignFrozen="right" class="text-right">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-900">{{ formatCurrency(data.total) }}</div>
                        <div class="font-black text-rose-600 text-xs">Sisa: {{ formatCurrency(data.remaining) }}</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-indigo-50/30 border-y border-indigo-100">
                        <h5 class="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2"><i class="pi pi-history"></i> Riwayat Penagihan / Cicilan</h5>
                        
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div v-if="slotProps.data.dp > 0" class="p-3 bg-white border border-indigo-100 rounded-lg flex justify-between shadow-sm">
                                <span class="text-xs">Uang Muka (DP) / Pembayaran Awal</span>
                                <span class="font-bold text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</span>
                            </div>

                            <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-3 bg-white border border-surface-200 rounded-lg flex justify-between shadow-sm">
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold">{{ pay.invoiceCode }}</span>
                                    <span class="text-[10px] text-surface-400">{{ formatDate(pay.date) }}</span>
                                </div>
                                <span class="font-bold text-emerald-600">+ {{ formatCurrency(pay.amount) }}</span>
                            </div>
                        </div>

                        <div v-if="slotProps.data.payments.length === 0 && slotProps.data.dp === 0" class="p-4 text-center text-surface-400 italic text-xs">Belum ada histori pembayaran.</div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>