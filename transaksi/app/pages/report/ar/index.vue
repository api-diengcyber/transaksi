<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const transactions = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const expandedRows = ref({});

// --- COMPUTED DATA ---

// Filter dan hitung saldo untuk Piutang
const consolidatedList = computed(() => {
    // 1. Ambil SALE (Kredit) dan AR Global
    const initialDebts = transactions.value.filter(t => 
        (t.type === 'SALE' && t.isCredit) || t.type === 'AR'
    );

    // 2. Ambil Pembayaran (PAY_AR)
    const payments = transactions.value.filter(t => t.type === 'PAY_AR');

    // 3. Gabungkan
    const paymentMap = payments.reduce((acc, p) => {
        const refCode = p.refCode;
        if (refCode) {
            acc[refCode] = (acc[refCode] || 0) + p.total;
        }
        return acc;
    }, {});

    return initialDebts.map(debt => {
        const paid = paymentMap[debt.code] || 0;
        const remaining = debt.total - paid;
        
        return {
            ...debt,
            paid: paid,
            remaining: remaining,
            isPaidOff: remaining <= 0.01,
            paymentHistory: payments.filter(p => p.refCode === debt.code)
        };
    });
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
        // HANYA Fetch data Piutang (SALE, AR, PAY_AR)
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
            const detailsMap = journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});

            const type = journal.code.split('-')[0];
            const isCredit = detailsMap['is_credit'] === 'true' || type === 'AR'; 

            let amount = 0;
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
                contact: detailsMap['customer_name'] || '-',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null, 
                method: detailsMap['payment_method'] || '-',
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode);

    } catch (e) {
        console.error("Gagal memuat data Laporan Piutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data', life: 3000 });
        transactions.value = [];
    } finally {
        loading.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => !dateString ? '-' : new Date(dateString).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-400">
        <div class="mb-4 pb-2 border-b border-surface-200 dark:border-surface-700 flex items-center gap-2 text-xl font-semibold text-emerald-600">
            <i class="pi pi-file"></i>
            <span>Laporan Piutang (AR)</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="p-4 rounded-xl shadow-sm border border-emerald-300 dark:border-emerald-800 bg-surface-0 dark:bg-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-wallet text-6xl text-emerald-600"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Piutang (Awal)</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ formatCurrency(stats.totalTagihan) }}</h3>
                <p class="text-xs text-surface-500 mt-2 font-medium">Total semua nota piutang</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-check-circle text-6xl text-blue-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Nota Lunas</p>
                <h3 class="text-2xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalLunas }} <span class="text-base font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-blue-500 mt-2 font-medium">Piutang selesai dibayar</p>
            </div>

            <div class="p-4 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-800 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-exclamation-triangle text-6xl text-orange-500"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Nota Belum Lunas</p>
                <h3 class="text-xl font-black text-surface-800 dark:text-surface-100">{{ stats.totalBelumLunas }} <span class="text-sm font-normal text-surface-400">Nota</span></h3>
                <p class="text-xs text-orange-500 mt-2 font-medium">Masih menggantung</p>
            </div>

             <div class="p-4 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <i class="pi pi-calculator text-6xl text-emerald-700"></i>
                </div>
                <p class="text-surface-500 text-xs font-bold uppercase tracking-wider mb-1">Total Sisa Piutang</p>
                <h3 class="text-2xl font-black text-emerald-600">{{ formatCurrency(stats.totalSisa) }}</h3>
                <p class="text-xs text-surface-500 mt-2 font-medium">Saldo yang harus ditagih</p>
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1 bg-surface-50/50 dark:bg-surface-400">
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari Nota / Pelanggan..." class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                     <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text size="small" @click="loadData" />
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="consolidatedList" 
                dataKey="code"
                :loading="loading"
                paginator :rows="10" 
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                rowHover
                class="text-sm"
            >
                <template #empty>
                    <div class="text-center py-12 text-surface-400">Tidak ada data laporan piutang.</div>
                </template>
                
                <Column expander style="width: 3rem" />

                <Column field="code" header="Info Nota" sortable style="width: 15%">
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-xs">{{ slotProps.data.code }}</span>
                            <div class="text-[11px] text-surface-500 mt-0.5">{{ formatDate(slotProps.data.date) }}</div>
                            <Tag v-if="slotProps.data.type === 'AR'" value="GLOBAL" severity="secondary" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                        </div>
                    </template>
                </Column>
                
                <Column field="contact" header="Pelanggan" sortable style="width: 15%" />

                <Column field="dueDate" header="Jatuh Tempo" sortable style="width: 10%">
                    <template #body="slotProps">
                        <span :class="new Date(slotProps.data.dueDate) < new Date() && !slotProps.data.isPaidOff ? 'text-red-500 font-bold' : ''">
                             {{ slotProps.data.dueDate || '-' }}
                        </span>
                    </template>
                </Column>
                
                <Column field="total" header="Total Tagihan" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-black text-sm">{{ formatCurrency(slotProps.data.total) }}</span>
                    </template>
                </Column>

                 <Column field="paid" header="Sudah Dibayar" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-medium text-sm text-emerald-600">{{ formatCurrency(slotProps.data.paid) }}</span>
                    </template>
                </Column>

                 <Column field="remaining" header="Sisa Tagihan" sortable class="text-right" style="width: 15%">
                    <template #body="slotProps">
                        <span class="font-black text-lg" :class="slotProps.data.isPaidOff ? 'text-green-600' : 'text-emerald-600'">
                            {{ formatCurrency(slotProps.data.remaining) }}
                        </span>
                         <Tag v-if="slotProps.data.isPaidOff" value="LUNAS" severity="success" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                         <Tag v-else-if="new Date(slotProps.data.dueDate) < new Date()" value="TELAT" severity="danger" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 dark:bg-surface-400 border-t border-b border-surface-200 dark:border-surface-800 shadow-inner">
                        <div class="flex items-center gap-2 mb-3 ml-1">
                            <i class="pi pi-history text-blue-500"></i>
                            <h5 class="font-bold text-xs uppercase">Riwayat Pembayaran Masuk</h5>
                        </div>
                        <DataTable :value="slotProps.data.paymentHistory" size="small" class="text-xs">
                            <Column field="code" header="No. Pembayaran" />
                            <Column field="date" header="Tanggal">
                                <template #body="i">{{ formatDate(i.data.date) }}</template>
                            </Column>
                            <Column field="method" header="Metode">
                                 <template #body="i"><Tag :value="i.data.method" severity="info" rounded class="!text-[9px]" /></template>
                            </Column>
                            <Column field="notes" header="Catatan" />
                            <Column field="total" header="Jumlah" class="text-right">
                                <template #body="i"><span class="font-bold text-emerald-600">+ {{ formatCurrency(i.data.total) }}</span></template>
                            </Column>
                        </DataTable>
                         <div v-if="slotProps.data.paymentHistory.length === 0" class="px-4 py-8 text-center text-surface-400 italic text-xs">Belum ada pembayaran.</div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>