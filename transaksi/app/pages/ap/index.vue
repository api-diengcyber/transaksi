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
    // Filter hanya transaksi yang berkaitan dengan Hutang
    // BUY (Kredit) atau AP (Hutang Global Manual)
    const buysCredit = debts.value.filter(t => (t.type === 'BUY' && t.isCredit) || t.type === 'AP');
    
    return buysCredit.map(debt => {
        // Cari semua pembayaran (PAY_AP) yang merujuk pada nota ini
        const paid = debts.value
            .filter(p => p.type === 'PAY_AP' && p.refCode === debt.code)
            .reduce((sum, p) => sum + p.total, 0);
            
        const remaining = debt.total - paid;
        return {
            ...debt,
            paid: paid,
            remaining: remaining,
            isPaidOff: remaining <= 0.01 // Toleransi koma
        };
    }).filter(d => d.remaining > 0); // Hanya tampilkan yang belum lunas
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // HANYA Fetch data terkait Hutang (BUY, AP, PAY_AP)
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
            const detailsMap = journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});
            const isCredit = detailsMap['is_credit'] === 'true';
            const type = journal.code.split('-')[0];

            let amount = 0;
            // Tentukan nominal berdasarkan tipe
            if (isCredit) amount = Number(detailsMap['grand_total'] || 0); // BUY Kredit
            else if (type === 'AP') amount = Number(detailsMap['amount'] || 0); // AP Global Manual
            else if (type === 'PAY_AP') amount = Number(detailsMap['nominal_ap_paid'] || 0); // Pembayaran Hutang

            return {
                code: journal.code,
                type: type, 
                date: journal.createdAt,
                total: amount,
                isCredit: isCredit || type === 'AP', 
                supplier: detailsMap['supplier'] || '-',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null,
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode); // Filter data kosong

    } catch (e) {
        console.error("Gagal memuat data Hutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Hutang', life: 3000 });
        debts.value = [];
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS: CREATE NEW ---

// Handler ketika modal create sukses menyimpan data
const onTransactionSaved = () => {
    loadData(); // Refresh tabel
};

// --- ACTIONS: PAYMENT (PELUNASAN) ---

const openPaymentModal = (debt) => {
    selectedDebt.value = debt;
    paymentDetails.value.amount = debt.remaining; // Default bayar lunas
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
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Error', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 p-4">
        
        <div class="mb-4 pb-2 border-b border-surface-200  flex items-center gap-2 text-xl font-semibold text-red-600">
            <i class="pi pi-arrow-down-left"></i>
            <span>Daftar Hutang (AP)</span>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200  overflow-hidden flex-1 bg-surface-50/50 ">
            
            <div class="p-4 border-b border-surface-200  flex flex-col sm:flex-row justify-between gap-4 items-center">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search text-surface-400" />
                    <InputText v-model="filters['global'].value" placeholder="Cari Nota / Supplier..." class="w-full sm:w-80 !rounded-lg pl-10" />
                </IconField>
                
                <div class="flex gap-2">
                    <Button 
                        label="Catat Hutang Baru" 
                        icon="pi pi-plus" 
                        severity="danger" 
                        size="small" 
                        @click="showCreateModal = true" 
                    />

                    <Button 
                        label="Refresh" 
                        icon="pi pi-refresh" 
                        severity="secondary" 
                        text 
                        size="small" 
                        @click="loadData" 
                    />
                </div>
            </div>

            <DataTable 
                :value="hutangList" 
                dataKey="code"
                :loading="loading"
                paginator :rows="10" 
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                class="text-sm"
            >
                <template #empty>
                    <div class="text-center py-10 text-surface-400">
                        <i class="pi pi-file-excel text-4xl mb-2 opacity-50"></i>
                        <p>Tidak ada hutang aktif.</p>
                    </div>
                </template>

                <Column field="code" header="No. Transaksi" sortable>
                    <template #body="{ data }">
                        <div class="font-bold font-mono text-xs">{{ data.code }}</div>
                        <div class="text-[11px] text-surface-500">{{ formatDate(data.date) }}</div>
                    </template>
                </Column>
                
                <Column field="supplier" header="Supplier" sortable>
                     <template #body="{ data }">
                        <span class="font-medium">{{ data.supplier }}</span>
                         <Tag v-if="data.type === 'AP'" value="GLOBAL" severity="secondary" rounded class="!text-[9px] ml-2 !font-extrabold !px-1.5" />
                    </template>
                </Column>

                <Column field="dueDate" header="Jatuh Tempo" sortable>
                    <template #body="{ data }">
                        <span :class="new Date(data.dueDate) < new Date() ? 'text-red-500 font-bold' : ''">{{ formatDate(data.dueDate) }}</span>
                    </template>
                </Column>
                
                <Column field="total" header="Total" sortable class="text-right">
                    <template #body="{ data }">{{ formatCurrency(data.total) }}</template>
                </Column>

                 <Column field="paid" header="Dibayar" sortable class="text-right">
                    <template #body="{ data }"><span class="text-emerald-600">{{ formatCurrency(data.paid) }}</span></template>
                </Column>

                 <Column field="remaining" header="Sisa" sortable class="text-right">
                    <template #body="{ data }">
                        <span class="font-black text-lg text-red-600">{{ formatCurrency(data.remaining) }}</span>
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body="{ data }">
                        <Button 
                            icon="pi pi-money-bill" 
                            severity="danger" 
                            rounded 
                            size="small"
                            v-tooltip.left="'Bayar Hutang'"
                            @click="openPaymentModal(data)" 
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="showPaymentModal" header="Bayar Hutang Supplier" :modal="true" class="w-11 md:w-3/5 lg:w-2/5">
            <div v-if="selectedDebt" class="p-fluid">
                <div class="mb-4 p-3 bg-red-50 rounded-lg border border-red-100">
                    <div class="flex justify-between items-center">
                         <span class="text-xs text-surface-500">Nota Referensi:</span>
                        <span class="font-bold text-sm">{{ selectedDebt.code }}</span>
                    </div>
                    <div class="flex justify-between font-bold mt-1">
                        <span>Sisa Tagihan:</span>
                        <span class="text-red-600 text-lg">{{ formatCurrency(selectedDebt.remaining) }}</span>
                    </div>
                </div>
                <div class="field mb-3">
                    <label class="font-bold text-sm">Jumlah Bayar</label>
                    <InputNumber 
                        v-model="paymentDetails.amount" 
                        mode="currency" 
                        currency="IDR" 
                        locale="id-ID" 
                        :max="selectedDebt.remaining"
                        inputClass="!text-lg !font-mono"
                    />
                </div>
                <div class="field mb-3">
                    <label class="font-bold text-sm">Metode</label>
                    <SelectButton 
                        v-model="paymentDetails.method" 
                        :options="[{label:'Cash', value:'CASH'}, {label:'Transfer', value:'TRANSFER'}]" 
                        optionLabel="label" 
                        optionValue="value"
                        class="w-full"
                        :pt="{ button: { class: '!text-xs !py-2' } }" 
                    />
                </div>
                <div class="field">
                    <label class="font-bold text-sm">Catatan</label>
                    <Textarea v-model="paymentDetails.notes" rows="2" />
                </div>
            </div>
            <template #footer>
                <Button label="Bayar Hutang" icon="pi pi-check" severity="danger" @click="processPayment" :loading="paymentProcessing" />
            </template>
        </Dialog>

        <ApCreateModal 
            v-model:visible="showCreateModal" 
            defaultType="hutang"
            @saved="onTransactionSaved"
        />
    </div>
</template>