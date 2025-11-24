<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Asumsi useJournalService sudah tersedia
const journalService = useJournalService();
const toast = useToast();

const props = defineProps({
    type: {
        type: String, // 'AR' (Piutang) atau 'AP' (Hutang)
        required: true
    }
});

const transactions = ref([]); // Berisi data jurnal AR, AP, SALE (credit), BUY (credit), PAY_AR, PAY_AP
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const expandedRows = ref({});

// --- COMPUTED DATA ---

const isAR = computed(() => props.type === 'AR');
const title = computed(() => isAR.value ? 'Piutang (Accounts Receivable)' : 'Hutang (Accounts Payable)');

// Filter dan hitung saldo untuk semua transaksi AR/AP
const consolidatedList = computed(() => {
    // 1. Dapatkan semua transaksi yang merupakan tagihan awal (SALE Credit, BUY Credit, AR Global, AP Global)
    const initialDebts = transactions.value.filter(t => 
        (isAR.value && (t.type === 'SALE' || t.type === 'AR') && t.isCredit) ||
        (!isAR.value && (t.type === 'BUY' || t.type === 'AP') && t.isCredit)
    );

    // 2. Map pembayaran (PAY_AR atau PAY_AP)
    const payments = transactions.value.filter(t => 
        (isAR.value && t.type === 'PAY_AR') ||
        (!isAR.value && t.type === 'PAY_AP')
    );

    // 3. Gabungkan dan hitung saldo
    const paymentMap = payments.reduce((acc, p) => {
        const refCode = p.refCode;
        if (refCode) {
            acc[refCode] = (acc[refCode] || 0) + p.total;
        }
        return acc;
    }, {});

    const list = initialDebts.map(debt => {
        const paid = paymentMap[debt.code] || 0;
        const remaining = debt.total - paid;
        
        return {
            ...debt,
            paid: paid,
            remaining: remaining,
            isPaidOff: remaining <= 0.01, // Menggunakan toleransi floating point
            paymentHistory: payments.filter(p => p.refCode === debt.code)
        };
    });

    return list;
});

// --- STATS SUMMARY ---
const stats = computed(() => {
    const list = consolidatedList.value;
    const totalTagihan = list.reduce((sum, d) => sum + d.total, 0);
    const totalLunas = list.filter(d => d.isPaidOff).length;
    const totalBelumLunas = list.filter(d => !d.isPaidOff).length;
    const totalSisa = list.reduce((sum, d) => sum + d.remaining, 0);
    
    return { totalTagihan, totalLunas, totalBelumLunas, totalSisa };
});


// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // Fetch semua journal yang relevan
        const [sales, buys, arGlobal, apGlobal, paymentsAr, paymentsAp] = await Promise.all([
             journalService.findAllByType('SALE').catch(() => []),
             journalService.findAllByType('BUY').catch(() => []),
             journalService.findAllByType('AR').catch(() => []), 
             journalService.findAllByType('AP').catch(() => []), 
             journalService.findAllByType('PAY_AR').catch(() => []),
             journalService.findAllByType('PAY_AP').catch(() => []),
        ]);
        
        const rawData = [
            ...(Array.isArray(sales) ? sales : []), 
            ...(Array.isArray(buys) ? buys : []),
            ...(Array.isArray(arGlobal) ? arGlobal : []),
            ...(Array.isArray(apGlobal) ? apGlobal : []),
            ...(Array.isArray(paymentsAr) ? paymentsAr : []),
            ...(Array.isArray(paymentsAp) ? paymentsAp : []),
        ];
        
        transactions.value = rawData
            .map(journal => {
            const detailsMap = journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});

            const type = journal.code.split('-')[0];
            const isCredit = detailsMap['is_credit'] === 'true' || type === 'AR' || type === 'AP'; 

            let amount = 0;
            if (isCredit && (type === 'SALE' || type === 'BUY')) {
                amount = Number(detailsMap['grand_total'] || 0); 
            } else if (type === 'AR' || type === 'AP') {
                 amount = Number(detailsMap['amount'] || 0); 
            } else if (type === 'PAY_AR') {
                amount = Number(detailsMap['nominal_ar_paid'] || 0); 
            } else if (type === 'PAY_AP') {
                amount = Number(detailsMap['nominal_ap_paid'] || 0); 
            }

            return {
                code: journal.code,
                type: type, 
                date: journal.createdAt,
                total: amount,
                isCredit: isCredit, 
                contact: isAR.value ? detailsMap['customer_name'] || '-' : detailsMap['supplier'] || '-',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null, 
                method: detailsMap['payment_method'] || '-',
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode);

    } catch (e) {
        console.error("Gagal memuat data Hutang/Piutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Hutang/Piutang', life: 3000 });
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
    if(!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

onMounted(() => {
    loadData();
});

watch(() => props.type, () => {
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
            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group"
                :class="isAR ? 'border-emerald-300' : 'border-red-300'">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-wallet text-6xl" :class="isAR ? 'text-emerald-600' : 'text-red-600'"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total {{ isAR ? 'Piutang' : 'Hutang' }} (Awal)</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalTagihan) }}</h3>
                <p class="text-xs text-surface-500 mt-2 font-medium flex items-center">Total semua nota/tagihan awal</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-check-circle text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Jumlah Nota Lunas</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalLunas }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Tagihan yang sudah diselesaikan</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-exclamation-triangle text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Jumlah Nota Belum Lunas</p>
                <h3 class="text-xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalBelumLunas }} <span class="text-sm font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-orange-500 mt-2 font-medium">Masih berupa tagihan/kewajiban</p>
            </div>

             <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group"
                :class="isAR ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-red-50 dark:bg-red-900/10'">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-calculator text-6xl" :class="isAR ? 'text-emerald-700' : 'text-red-700'"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Sisa {{ isAR ? 'Piutang' : 'Hutang' }}</p>
                <h3 class="text-2xl font-black" :class="isAR ? 'text-emerald-600' : 'text-red-600'">{{ formatCurrency(stats.totalSisa) }}</h3>
                <p class="text-xs text-surface-500 mt-2 font-medium">Sisa saldo yang belum dibayar</p>
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" :placeholder="`Cari Nota / ${isAR ? 'Pelanggan' : 'Supplier'}...`" class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                     <Button label="Filter Periode" icon="pi pi-calendar" severity="secondary" text size="small" />
                     <Button label="Export" icon="pi pi-file-excel" severity="success" text size="small" />
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="consolidatedList" 
                dataKey="code"
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
                        <i class="pi pi-file-excel text-4xl mb-2 opacity-50"></i>
                        <p>Tidak ada data {{ title.toLowerCase() }}.</p>
                    </div>
                </template>
                
                <Column expander style="width: 3rem" />

                <Column field="code" header="Info Nota" sortable style="width: 15%">
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-xs text-surface-700 dark:text-surface-200">
                                {{ slotProps.data.code }}
                            </span>
                            <div class="text-[11px] text-surface-500 mt-0.5">
                                {{ formatDate(slotProps.data.date) }}
                            </div>
                            <Tag v-if="slotProps.data.type === 'AR' || slotProps.data.type === 'AP'" value="GLOBAL" severity="secondary" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                        </div>
                    </template>
                </Column>
                
                <Column field="contact" :header="isAR ? 'Pelanggan/Debitur' : 'Supplier/Kreditur'" sortable style="width: 15%">
                     <template #body="slotProps">
                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ slotProps.data.contact }}</span>
                    </template>
                </Column>

                <Column field="dueDate" header="Jatuh Tempo" sortable style="width: 10%">
                    <template #body="slotProps">
                        <span :class="new Date(slotProps.data.dueDate) < new Date() && !slotProps.data.isPaidOff ? 'text-red-500 font-bold' : 'text-surface-700'">
                             {{ slotProps.data.dueDate || '-' }}
                        </span>
                    </template>
                </Column>
                
                <Column field="total" header="Total Tagihan" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-black text-sm text-surface-800 dark:text-surface-100">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                 <Column field="paid" header="Sudah Dibayar" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-medium text-sm text-emerald-600">
                            {{ formatCurrency(slotProps.data.paid) }}
                        </span>
                    </template>
                </Column>

                 <Column field="remaining" header="Sisa Tagihan" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-black text-lg"
                            :class="slotProps.data.isPaidOff ? 'text-green-600' : isAR ? 'text-emerald-600' : 'text-red-600'"
                        >
                            {{ formatCurrency(slotProps.data.remaining) }}
                        </span>
                         <Tag v-if="slotProps.data.isPaidOff" value="LUNAS" severity="success" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                         <Tag v-else-if="new Date(slotProps.data.dueDate) < new Date()" value="TELAT" severity="danger" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                    </template>
                </Column>

                <Column style="width: 5rem; text-align: center">
                    <template #body="slotProps">
                        <NuxtLink :to="`/arap?tab=debt-payment&code=${slotProps.data.code}`" v-tooltip.left="`Bayar ${isAR ? 'Piutang' : 'Hutang'}`" :disabled="slotProps.data.isPaidOff">
                            <Button 
                                icon="pi pi-money-bill" 
                                :severity="isAR ? 'success' : 'danger'"
                                rounded 
                                text
                                size="small" 
                            />
                        </NuxtLink>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 dark:bg-surface-950/50 border-t border-b border-surface-200 dark:border-surface-800 shadow-inner">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-file-invoice text-blue-500 bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-md"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Riwayat Pembayaran</h5>
                        </div>
                        
                        <div class="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden">
                            <DataTable :value="slotProps.data.paymentHistory" size="small" class="text-xs">
                                <Column field="code" header="No. Pembayaran" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ i.data.code }}</span>
                                    </template>
                                </Column>
                                <Column field="date" header="Tanggal Bayar" style="width: 150px">
                                    <template #body="i">
                                        {{ formatDate(i.data.date) }}
                                    </template>
                                </Column>
                                <Column field="method" header="Metode" style="width: 100px">
                                     <template #body="i">
                                        <Tag :value="i.data.method" severity="info" rounded class="!text-[9px] !font-extrabold !px-1.5 w-fit uppercase" />
                                    </template>
                                </Column>
                                <Column field="notes" header="Catatan">
                                    <template #body="i">
                                         <span class="text-surface-600 dark:text-surface-400 text-xs truncate max-w-[300px] block">{{ i.data.notes || '-' }}</span>
                                    </template>
                                </Column>
                                <Column field="total" header="Jumlah Bayar" class="text-right" style="width: 150px">
                                    <template #body="i">
                                        <span class="font-bold text-emerald-600 dark:text-emerald-400">
                                            + {{ formatCurrency(i.data.total) }}
                                        </span>
                                    </template>
                                </Column>
                            </DataTable>
                             <div v-if="slotProps.data.paymentHistory.length === 0" class="px-4 py-8 text-center text-surface-400 italic text-xs bg-white dark:bg-surface-900">
                                Belum ada pembayaran untuk nota ini.
                            </div>
                        </div>
                    </div>
                </template>

            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Custom Dark Mode Styles for DataTable - Disesuaikan dari komponen lain */
:deep(.p-datatable) { background: transparent !important; border-color: transparent !important; }
:deep(.p-datatable-thead > tr > th) { background-color: var(--p-surface-50) !important; color: var(--p-text-color) !important; border-color: var(--p-surface-200) !important; }
.dark :deep(.p-datatable-thead > tr > th) { background-color: var(--p-surface-900) !important; color: var(--p-surface-100) !important; border-color: var(--p-surface-800) !important; }
:deep(.p-datatable-tbody > tr) { background-color: var(--p-surface-0) !important; color: var(--p-text-color) !important; border-color: var(--p-surface-200) !important; }
:deep(.p-datatable-tbody .p-row-even) { background-color: var(--p-surface-50) !important; }
.dark :deep(.p-datatable-tbody > tr) { background-color: var(--p-surface-900) !important; }
.dark :deep(.p-datatable-tbody .p-row-even) { background-color: var(--p-surface-950) !important; }
.dark :deep(.p-datatable-tbody .p-row-odd) { background-color: var(--p-surface-900) !important; }
.dark :deep(.p-datatable-tbody > tr:hover) { background-color: var(--p-surface-800) !important; }
:deep(.p-datatable-tbody > tr:hover) { background-color: var(--p-surface-100) !important; }
:deep(.p-datatable .p-datatable-tbody > tr > td) { vertical-align: top; border-color: var(--p-surface-200); }
.dark :deep(.p-datatable .p-datatable-tbody > tr > td) { border-color: var(--p-surface-800); }
</style>