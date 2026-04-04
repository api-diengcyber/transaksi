<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

// Import komponen Modal Tambah (Sesuaikan path jika berbeda)
import ApCreateModal from '~/components/ap/ApCreateModal.vue';

const journalService = useJournalService();
const toast = useToast();

const debts = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// State Modal Tambah Baru
const showCreateModal = ref(false);

// State Modal Pembayaran (Pelunasan)
const showPaymentModal = ref(false);
const selectedDebt = ref(null);
const paymentDetails = ref({
    amount: null,
    method: 'CASH',
    notes: ''
});
const paymentProcessing = ref(false);

// --- COMPUTED DATA ---

const hutangList = computed(() => {
    // Filter hanya transaksi yang berkaitan dengan Hutang (Pembelian Kredit atau AP Manual)
    const buysCredit = debts.value.filter(t => (t.type === 'BUY' && t.isCredit) || t.type === 'AP');
    
    return buysCredit.map(debt => {
        // Cari total pembayaran (PAY_AP) yang merujuk pada nota ini
        const paidLog = debts.value
            .filter(p => p.type === 'PAY_AP' && p.refCode === debt.code)
            .reduce((sum, p) => sum + p.total, 0);
            
        // TOTAL DIBAYAR = Riwayat Pembayaran (PAY_AP) + Uang Muka (DP) saat transaksi awal
        const totalDibayar = paidLog + debt.dp;
        const remaining = debt.total - totalDibayar;

        return {
            ...debt,
            paid: totalDibayar, // Total uang keluar untuk cicilan/DP
            remaining: remaining,
            isPaidOff: remaining <= 0.01 // Toleransi desimal
        };
    }).filter(d => d.remaining > 0); // Hanya tampilkan yang belum lunas
});

// Ringkasan untuk Header Cards
const summary = computed(() => {
    const totalHutang = hutangList.value.reduce((sum, d) => sum + d.total, 0);
    const totalDibayar = hutangList.value.reduce((sum, d) => sum + d.paid, 0);
    const totalSisa = hutangList.value.reduce((sum, d) => sum + d.remaining, 0);
    const jatuhTempoCount = hutangList.value.filter(d => d.dueDate && new Date(d.dueDate) < new Date()).length;
    return { totalHutang, totalDibayar, totalSisa, jatuhTempoCount };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // Fetch data terkait Hutang (BUY, AP, PAY_AP)
        const [buys, apGlobal, paymentsAp] = await Promise.all([
             journalService.findAllByType('BUY').catch(() => []),
             journalService.findAllByType('AP').catch(() => []),
             journalService.findAllByType('PAY_AP').catch(() => []),
        ]);
        
        const rawData = [
            ...(Array.isArray(buys) ? buys : []),
            ...(Array.isArray(apGlobal) ? apGlobal : []),
            ...(Array.isArray(paymentsAp) ? paymentsAp : []),
        ];
        
        debts.value = rawData.map(journal => {
            const detailsMap = (journal.details || []).reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});
            const isCredit = detailsMap['is_credit'] === 'true' || detailsMap['is_credit'] === true;
            
            // Deteksi Tipe Transaksi
            let type = 'UNKNOWN';
            if (journal.code.includes('BUY')) type = 'BUY';
            else if (journal.code.includes('PAY_AP')) type = 'PAY_AP';
            else if (journal.code.includes('AP')) type = 'AP';

            let amount = 0;
            let dp = 0;

            // Tentukan nominal dan DP berdasarkan tipe
            if (isCredit && type === 'BUY') {
                amount = Number(detailsMap['grand_total'] || 0); 
                dp = Number(detailsMap['amount_cash'] || 0); // Di Pembelian, uang tunai yang dibayar di awal adalah DP
            } else if (type === 'AP') {
                amount = Number(detailsMap['amount'] || 0); 
                dp = Number(detailsMap['dp_amount'] || 0); 
            } else if (type === 'PAY_AP') {
                amount = Number(detailsMap['nominal_ap_paid'] || 0); 
            }

            return {
                code: journal.code,
                type: type, 
                date: journal.createdAt,
                total: amount,
                dp: dp,
                isCredit: isCredit || type === 'AP', 
                supplier: detailsMap['supplier'] || detailsMap['supplier_name'] || '-',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null,
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode);

    } catch (e) {
        console.error("Gagal memuat data Hutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Hutang', life: 3000 });
        debts.value = [];
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS ---
const onTransactionSaved = () => {
    loadData(); 
};

const openPaymentModal = (debt) => {
    selectedDebt.value = debt;
    paymentDetails.value.amount = debt.remaining; 
    paymentDetails.value.notes = `Pembayaran Hutang Nota ${debt.code}`;
    paymentDetails.value.method = 'CASH';
    showPaymentModal.value = true;
};

const processPayment = async () => {
    if (!selectedDebt.value || paymentDetails.value.amount <= 0 || paymentProcessing.value) return;

    if (paymentDetails.value.amount > selectedDebt.value.remaining) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Jumlah bayar melebihi sisa tagihan.', life: 3000 });
        return;
    }
    
    paymentProcessing.value = true;
    try {
        const payload = {
            amount: paymentDetails.value.amount,
            reference_journal_code: selectedDebt.value.code,
            payment_method: paymentDetails.value.method,
            notes: paymentDetails.value.notes,
            supplier: selectedDebt.value.supplier
        };

        await journalService.createApPaymentTransaction({ details: payload });

        toast.add({ severity: 'success', summary: 'Sukses', detail: `Pembayaran keluar dicatat.`, life: 3000 });
        showPaymentModal.value = false;
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi Kesalahan', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const isOverdue = (dateString) => {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
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
                    Manajemen Hutang (AP)
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau dan kelola kewajiban pembayaran ke supplier.</p>
            </div>
            
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Catat Hutang Manual" icon="pi pi-plus" severity="danger" size="small" @click="showCreateModal = true" class="!rounded-xl shadow-sm hover:!bg-rose-700" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0">
                    <i class="pi pi-truck text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Hutang</div>
                    <div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalHutang) }}</div>
                </div>
            </div>
            
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                    <i class="pi pi-money-bill text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Telah Dibayar (Ags/DP)</div>
                    <div class="text-xl font-black text-blue-600">{{ formatCurrency(summary.totalDibayar) }}</div>
                </div>
            </div>

            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-rose-500">
                <div class="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                    <i class="pi pi-wallet text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Sisa Kewajiban (Aktif)</div>
                    <div class="text-2xl font-black text-rose-600">{{ formatCurrency(summary.totalSisa) }}</div>
                </div>
            </div>

            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4" :class="{'border-l-4 border-l-red-500 bg-red-50/10': summary.jatuhTempoCount > 0}">
                <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" :class="summary.jatuhTempoCount > 0 ? 'bg-red-100 text-red-500' : 'bg-surface-100 text-surface-400'">
                    <i class="pi pi-calendar-times text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Lewat Jatuh Tempo</div>
                    <div class="text-xl font-black" :class="summary.jatuhTempoCount > 0 ? 'text-red-600' : 'text-surface-900'">{{ summary.jatuhTempoCount }} Transaksi</div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="relative w-full sm:w-96">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input 
                        v-model="filters['global'].value" 
                        type="text" 
                        placeholder="Cari No. Faktur atau Supplier..." 
                        class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-rose-500 focus:border-rose-500 transition-colors"
                    />
                </div>
                <div class="text-xs font-medium text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200">
                    Menampilkan <span class="font-bold text-surface-900">{{ hutangList.length }}</span> hutang aktif
                </div>
            </div>

            <DataTable 
                :value="hutangList" 
                dataKey="code"
                :loading="loading"
                paginator 
                :rows="15" 
                :rowsPerPageOptions="[15, 30, 50]"
                :filters="filters"
                stripedRows
                responsiveLayout="scroll"
                class="p-datatable-sm flex-1 text-sm border-none"
                :pt="{ headerRow: { class: 'bg-surface-50' } }"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 px-4 text-surface-500">
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                            <i class="pi pi-check-circle text-4xl text-emerald-400"></i>
                        </div>
                        <h3 class="text-lg font-bold text-surface-700">Semua Hutang Lunas</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Saat ini tidak ada kewajiban/hutang ke supplier yang tertunda.</p>
                    </div>
                </template>

                <Column field="code" header="Informasi Tagihan" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block w-max border border-rose-100">
                                {{ data.code }}
                            </div>
                            <div class="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
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
                                <Tag v-if="data.type === 'AP'" value="MANUAL ENTRY" severity="secondary" rounded class="!text-[8px] !px-1.5 mt-0.5 w-max" />
                                <span v-else class="text-[10px] text-surface-500 mt-0.5">Pembelian Kredit</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="dueDate" header="Status / Jatuh Tempo" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex flex-col items-start gap-1">
                            <Tag v-if="isOverdue(data.dueDate)" value="Lewat Waktu" severity="danger" class="!text-[9px] !font-bold !px-2" rounded />
                            <Tag v-else value="Belum Jatuh Tempo" severity="info" class="!text-[9px] !font-bold !px-2 !bg-blue-50 !text-blue-600 !border !border-blue-200" rounded />
                            <span class="text-xs font-medium" :class="isOverdue(data.dueDate) ? 'text-red-600 font-bold' : 'text-surface-600'">
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
                            <div class="flex justify-between text-blue-600">
                                <span>Telah Dibayar (Termasuk DP):</span>
                                <span>- {{ formatCurrency(data.paid) }}</span>
                            </div>
                            <div class="border-t border-dashed border-surface-200 pt-1 flex justify-between items-center">
                                <span class="font-bold text-surface-800">Sisa Tagihan:</span>
                                <span class="font-black text-sm text-rose-600">{{ formatCurrency(data.remaining) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column alignFrozen="right" class="text-center" style="width: 6rem">
                    <template #body="{ data }">
                        <Button 
                            label="Bayar" 
                            icon="pi pi-wallet" 
                            severity="danger" 
                            size="small" 
                            class="!rounded-xl !text-xs font-bold shadow-sm !px-3"
                            @click="openPaymentModal(data)" 
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="showPaymentModal" header="Bayar Hutang Supplier" :modal="true" class="w-[95vw] sm:w-[450px]" :pt="{ root: { class: '!rounded-2xl !border-0 !shadow-2xl' }, header: { class: '!bg-surface-50 !border-b !border-surface-200 !pb-4' }, content: { class: '!pt-4 !pb-0' } }">
            <div v-if="selectedDebt" class="flex flex-col h-full">
                
                <div class="mb-5 p-4 bg-rose-50 rounded-xl border border-rose-100 flex flex-col gap-2 relative overflow-hidden">
                    <div class="absolute -right-4 -bottom-4 opacity-10">
                        <i class="pi pi-money-bill text-8xl"></i>
                    </div>
                    <div>
                        <span class="text-xs text-rose-700/70 font-semibold uppercase tracking-wider block">Supplier / Vendor</span>
                        <span class="font-bold text-rose-900 text-base">{{ selectedDebt.supplier }}</span>
                    </div>
                    <div class="flex justify-between items-end mt-2 pt-2 border-t border-rose-200/50 relative z-10">
                        <div>
                            <span class="text-[10px] text-rose-700/70 font-semibold block mb-0.5">Sisa Kewajiban</span>
                            <span class="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded text-rose-800">{{ selectedDebt.code }}</span>
                        </div>
                        <span class="text-2xl font-black text-rose-700">{{ formatCurrency(selectedDebt.remaining) }}</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Jumlah yang Ingin Dibayar</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-400">Rp</span>
                            <InputNumber 
                                v-model="paymentDetails.amount" 
                                mode="decimal" 
                                locale="id-ID" 
                                :max="selectedDebt.remaining"
                                class="w-full"
                                inputClass="!text-lg !font-black !py-2.5 !pl-9 !text-rose-600 focus:!ring-rose-500 focus:!border-rose-500" 
                            />
                        </div>
                        <div class="flex justify-end mt-1">
                            <button class="text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline bg-rose-50 px-2 py-0.5 rounded transition-colors" @click="paymentDetails.amount = selectedDebt.remaining">
                                Bayar Pas (Lunas)
                            </button>
                        </div>
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Metode Pembayaran</label>
                        <SelectButton 
                            v-model="paymentDetails.method" 
                            :options="[{label:'Tunai (Cash)', value:'CASH'}, {label:'Transfer Bank', value:'TRANSFER'}]" 
                            optionLabel="label" 
                            optionValue="value"
                            class="w-full"
                            :pt="{ button: { class: '!text-xs !py-2.5 flex-1' } }" 
                        />
                    </div>

                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Catatan / Bukti Transfer</label>
                        <Textarea v-model="paymentDetails.notes" rows="2" class="w-full !text-sm resize-none" placeholder="Cth: Transfer via Mandiri..." />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="flex gap-2 w-full pt-4 border-t border-surface-200 mt-2">
                    <Button label="Batal" class="flex-1 !rounded-xl font-bold" severity="secondary" text @click="showPaymentModal = false" />
                    <Button label="Proses Pembayaran" icon="pi pi-check-circle" class="flex-[2] !rounded-xl font-bold shadow-md" severity="danger" @click="processPayment" :loading="paymentProcessing" />
                </div>
            </template>
        </Dialog>

        <ApCreateModal 
            v-model:visible="showCreateModal" 
            defaultType="hutang"
            @saved="onTransactionSaved"
        />
    </div>
</template>