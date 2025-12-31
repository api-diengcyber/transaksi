<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

// Asumsi auto-import composables
const journalService = useJournalService();
const toast = useToast();

const transactions = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const expandedRows = ref({});

// --- COMPUTED DATA ---

// 1. Konsolidasi Data: Menggabungkan Tagihan (SALE/AR) dengan Pembayaran (PAY_AR)
const consolidatedList = computed(() => {
    // A. Ambil "Hutang Awal/Tagihan": 
    //    - SALE dengan status kredit (isCredit = true)
    //    - AR (Input Piutang Manual/Saldo Awal)
    const initialDebts = transactions.value.filter(t => 
        (t.type === 'SALE' && t.isCredit) || t.type === 'AR'
    );

    // B. Ambil "Pembayaran":
    //    - PAY_AR (Cicilan Piutang)
    const payments = transactions.value.filter(t => t.type === 'PAY_AR');

    // C. Buat Map Pembayaran berdasarkan Ref Code (Kode Nota Tagihan)
    const paymentMap = payments.reduce((acc, p) => {
        const refCode = p.refCode;
        if (refCode) {
            if (!acc[refCode]) acc[refCode] = [];
            acc[refCode].push(p);
        }
        return acc;
    }, {});

    // D. Gabungkan
    return initialDebts.map(debt => {
        const relatedPayments = paymentMap[debt.code] || [];
        const totalPaid = relatedPayments.reduce((sum, p) => sum + p.total, 0);
        const remaining = debt.total - totalPaid;
        
        // Toleransi selisih koma 100 perak dianggap lunas
        const isPaidOff = remaining <= 100; 

        return {
            ...debt,
            paid: totalPaid,
            remaining: remaining < 0 ? 0 : remaining, // Hindari minus
            isPaidOff: isPaidOff,
            paymentHistory: relatedPayments.sort((a,b) => new Date(b.date) - new Date(a.date)) // Sort pembayaran terbaru
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort tagihan terbaru
});

// 2. Statistik Summary
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
        // Fetch SALE, AR, dan PAY_AR secara paralel
        const [sales, arGlobal, paymentsAr] = await Promise.all([
             journalService.findAllByType('SALE').catch(() => []),
             journalService.findAllByType('AR').catch(() => []), 
             journalService.findAllByType('PAY_AR').catch(() => []),
        ]);
        
        const rawData = [
            ...(Array.isArray(sales) ? sales : []), 
            ...(Array.isArray(arGlobal) ? arGlobal : []),
            ...(Array.isArray(paymentsAr) ? paymentsAr : []),
        ];
        
        transactions.value = rawData
            .map(journal => {
            const detailsMap = (journal.details || []).reduce((acc, curr) => { 
                acc[curr.key] = curr.value; return acc; 
            }, {});

            const type = journal.code.split('-')[0]; // Ambil prefix kode (SALE, AR, PAY)
            // Cek apakah ini transaksi kredit
            const isCredit = detailsMap['is_credit'] === 'true' || type === 'AR'; 

            let amount = 0;
            // Normalisasi jumlah uang berdasarkan tipe
            if (isCredit && type === 'SALE') {
                amount = Number(detailsMap['grand_total'] || 0); 
            } else if (type === 'AR') {
                 amount = Number(detailsMap['amount'] || 0); 
            } else if (type === 'PAY_AR') {
                amount = Number(detailsMap['nominal_ar_paid'] || 0); 
            }

            return {
                code: journal.code,
                type: type, 
                date: journal.createdAt,
                total: amount,
                isCredit: isCredit, 
                contact: detailsMap['customer_name'] || 'Tanpa Nama',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null, // Kode referensi untuk pembayaran
                method: detailsMap['payment_method'] || '-',
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode); // Filter data sampah

    } catch (e) {
        console.error("Gagal memuat data Laporan Piutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data piutang.', life: 3000 });
        transactions.value = [];
    } finally {
        loading.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Cek status jatuh tempo
const isOverdue = (item) => {
    if (item.isPaidOff) return false;
    if (!item.dueDate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    return new Date(item.dueDate) < today;
};

onMounted(() => { loadData(); });
const refreshData = async () => await loadData();
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col h-full bg-surface-50 dark:bg-surface-100 transition-colors duration-300">
        
        <div class="mb-8">
            <h1 class="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-0 tracking-tight">Laporan Piutang (AR)</h1>
            <p class="text-surface-500 dark:text-surface-400 mt-1 text-sm">Monitoring tagihan pelanggan, jatuh tempo, dan riwayat pembayaran.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            
            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-emerald-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Total Tagihan</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ formatCurrency(stats.totalTagihan) }}</h3>
                    </div>
                    <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <i class="pi pi-wallet text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400">Akumulasi seluruh nota kredit</p>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-blue-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Lunas</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ stats.totalLunas }} <span class="text-sm font-medium text-surface-400">Nota</span></h3>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-500/10 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
                        <i class="pi pi-check-circle text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400">Tagihan selesai dibayar</p>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <div class="bg-orange-500 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-widest mb-1">Belum Lunas</p>
                        <h3 class="text-2xl font-black text-surface-800 dark:text-surface-0">{{ stats.totalBelumLunas }} <span class="text-sm font-medium text-surface-400">Nota</span></h3>
                    </div>
                    <div class="bg-orange-50 dark:bg-orange-500/10 p-2.5 rounded-xl text-orange-600 dark:text-orange-400">
                        <i class="pi pi-hourglass text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-surface-500 dark:text-surface-400">Menunggu pembayaran</p>
            </div>

             <div class="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 shadow-sm border border-emerald-200 dark:border-emerald-800 relative overflow-hidden group hover:shadow-md transition-all">
                <div class="absolute -right-6 -top-6 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div class="bg-emerald-600 rounded-full w-24 h-24 blur-xl"></div>
                </div>
                <div class="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">Sisa Piutang (Balance)</p>
                        <h3 class="text-2xl font-black text-emerald-800 dark:text-emerald-100">{{ formatCurrency(stats.totalSisa) }}</h3>
                    </div>
                    <div class="bg-surface-0/50 dark:bg-surface-100/50 p-2.5 rounded-xl text-emerald-700 dark:text-emerald-400 shadow-sm">
                        <i class="pi pi-chart-pie text-xl"></i>
                    </div>
                </div>
                <p class="text-xs text-emerald-700/70 dark:text-emerald-300/70 font-medium">Uang yang harus ditagih</p>
            </div>
        </div>

        <div class="bg-surface-0 dark:bg-surface-100 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-0 dark:bg-surface-100">
                <div class="w-full sm:w-auto relative">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <InputText v-model="filters['global'].value" placeholder="Cari No. Nota, Pelanggan..." class="w-full sm:w-80 !pl-10 !rounded-xl" size="small" />
                </div>
                <div class="flex gap-2">
                     <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text size="small" @click="loadData" />
                     <Button label="Export" icon="pi pi-file-excel" severity="secondary" outlined size="small" />
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
                class="flex-1 custom-table"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <div class="bg-surface-50 dark:bg-surface-700 p-4 rounded-full mb-3">
                            <i class="pi pi-inbox text-4xl opacity-50"></i>
                        </div>
                        <p class="font-medium">Belum ada data piutang.</p>
                    </div>
                </template>
                
                <Column expander style="width: 3rem" />

                <Column field="code" header="Info Nota" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-sm tracking-tight text-emerald-700 dark:text-emerald-400">{{ slotProps.data.code }}</span>
                            <div class="text-[11px] text-surface-500 mt-1 flex items-center gap-1">
                                <i class="pi pi-calendar text-[9px]"></i>
                                {{ formatDate(slotProps.data.date) }}
                            </div>
                            <Tag v-if="slotProps.data.type === 'AR'" value="SALDO AWAL" severity="secondary" rounded class="!text-[9px] mt-1 !font-bold !px-1.5 w-fit" />
                        </div>
                    </template>
                </Column>
                
                <Column field="contact" header="Pelanggan" sortable>
                    <template #body="slotProps">
                         <div class="flex items-center gap-2">
                            <Avatar :label="slotProps.data.contact ? slotProps.data.contact.charAt(0).toUpperCase() : 'U'" shape="circle" size="small" class="!bg-surface-200 dark:!bg-surface-700 !text-surface-600 dark:!text-surface-300 !text-xs" />
                            <div class="flex flex-col">
                                <span class="font-medium text-surface-700 dark:text-surface-200 text-sm">{{ slotProps.data.contact }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="dueDate" header="Jatuh Tempo" sortable>
                    <template #body="slotProps">
                        <div v-if="slotProps.data.isPaidOff" class="text-surface-400 text-xs flex items-center gap-1">
                            <i class="pi pi-check text-[9px]"></i> Selesai
                        </div>
                        <div v-else-if="slotProps.data.dueDate">
                            <span class="text-xs" :class="isOverdue(slotProps.data) ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-surface-600 dark:text-surface-300'">
                                 {{ formatDate(slotProps.data.dueDate) }}
                            </span>
                            <div v-if="isOverdue(slotProps.data)" class="text-[9px] text-rose-500 mt-0.5">Lewat Jatuh Tempo</div>
                        </div>
                        <div v-else class="text-surface-400 text-xs">-</div>
                    </template>
                </Column>
                
                <Column field="total" header="Total Tagihan" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-medium text-sm text-surface-600 dark:text-surface-300">{{ formatCurrency(slotProps.data.total) }}</span>
                    </template>
                </Column>

                 <Column field="paid" header="Dibayar" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-medium text-sm text-emerald-600 dark:text-emerald-400">{{ formatCurrency(slotProps.data.paid) }}</span>
                    </template>
                </Column>

                 <Column field="remaining" header="Sisa" sortable class="text-right">
                    <template #body="slotProps">
                        <div class="flex flex-col items-end gap-1">
                            <span class="font-black text-sm" :class="slotProps.data.isPaidOff ? 'text-surface-400 dark:text-surface-600 decoration-line-through' : 'text-surface-900 dark:text-surface-0'">
                                {{ formatCurrency(slotProps.data.remaining) }}
                            </span>
                            <Tag v-if="slotProps.data.isPaidOff" value="LUNAS" severity="success" rounded class="!text-[9px] !font-bold !px-1.5" />
                            <Tag v-else-if="isOverdue(slotProps.data)" value="JATUH TEMPO" severity="danger" rounded class="!text-[9px] !font-bold !px-1.5" />
                        </div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-100/50 border-y border-surface-200 dark:border-surface-700">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-history text-blue-500"></i>
                            <h5 class="font-bold text-surface-700 dark:text-surface-200 text-xs uppercase tracking-wide">Riwayat Pembayaran Masuk</h5>
                        </div>
                        
                        <div class="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden bg-surface-0 dark:bg-surface-100 shadow-sm max-w-3xl">
                            <DataTable :value="slotProps.data.paymentHistory" size="small" class="text-xs">
                                <Column field="code" header="No. Pembayaran" />
                                <Column field="date" header="Tanggal">
                                    <template #body="i">{{ formatDate(i.data.date) }}</template>
                                </Column>
                                <Column field="method" header="Metode">
                                     <template #body="i">
                                         <Tag :value="i.data.method" severity="info" rounded class="!text-[9px] uppercase" />
                                     </template>
                                </Column>
                                <Column field="notes" header="Catatan">
                                    <template #body="i">
                                        <span class="italic text-surface-500">{{ i.data.notes || '-' }}</span>
                                    </template>
                                </Column>
                                <Column field="total" header="Jumlah Masuk" class="text-right">
                                    <template #body="i"><span class="font-bold text-emerald-600 dark:text-emerald-400">+ {{ formatCurrency(i.data.total) }}</span></template>
                                </Column>
                            </DataTable>
                             <div v-if="slotProps.data.paymentHistory.length === 0" class="px-4 py-8 text-center text-surface-400 italic text-xs bg-surface-0 dark:bg-surface-100">
                                Belum ada riwayat pembayaran untuk nota ini.
                            </div>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
/* Styling khusus untuk DataTable agar menyatu dengan background */
:deep(.custom-table .p-datatable-thead > tr > th) {
    background-color: transparent;
    color: var(--p-surface-500);
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 700;
    padding-top: 1rem;
    padding-bottom: 1rem;
}

:deep(.custom-table .p-datatable-tbody > tr) {
    background-color: transparent;
    transition: background-color 0.2s;
}

:deep(.custom-table .p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-50);
}

.dark :deep(.custom-table .p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-700);
}

:deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-surface-100);
}

.dark :deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-surface-700);
}

/* Pagination Styling */
:deep(.p-paginator) {
    border-top: 1px solid var(--p-surface-200);
    background: transparent;
}
.dark :deep(.p-paginator) {
    border-top: 1px solid var(--p-surface-700);
}
</style>