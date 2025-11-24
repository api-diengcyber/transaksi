<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const debts = ref([]); // Berisi data Piutang (AR) dan Hutang (AP), termasuk nota awal dan pembayarannya
const loading = ref(true);
const activeTab = ref('piutang'); // 'piutang' atau 'hutang'
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// State Modal Pembayaran
const showPaymentModal = ref(false);
const selectedDebt = ref(null);
const paymentDetails = ref({
    amount: null,
    method: 'CASH',
    notes: ''
});
const paymentProcessing = ref(false);

// --- COMPUTED DATA ---

// Mendapatkan Piutang yang Aktif (dari SALE kredit dan AR Global)
const piutangList = computed(() => {
    // Filter transaksi Piutang (SALE kredit, AR Global)
    const salesCredit = debts.value.filter(t => (t.type === 'SALE' && t.isCredit) || t.type === 'AR');
    
    // Hitung total pembayaran untuk setiap Piutang
    return salesCredit.map(debt => {
        // Cari semua pembayaran Piutang (PAY_AR) yang merujuk pada nota ini
        const paid = debts.value
            .filter(p => p.type === 'PAY_AR' && p.refCode === debt.code)
            .reduce((sum, p) => sum + p.amount, 0);
            
        const remaining = debt.total - paid;
        return {
            ...debt,
            paid: paid,
            remaining: remaining,
            isPaidOff: remaining <= 0.01 // Toleransi floating point
        };
    }).filter(d => d.remaining > 0); // Hanya tampilkan yang belum lunas
});

// Mendapatkan Hutang yang Aktif (dari BUY kredit dan AP Global)
const hutangList = computed(() => {
    // Filter transaksi Hutang (BUY kredit, AP Global)
    const buysCredit = debts.value.filter(t => (t.type === 'BUY' && t.isCredit) || t.type === 'AP');
    
    // Hitung total pembayaran untuk setiap Hutang
    return buysCredit.map(debt => {
        // Cari semua pembayaran Hutang (PAY_AP) yang merujuk pada nota ini
        const paid = debts.value
            .filter(p => p.type === 'PAY_AP' && p.refCode === debt.code)
            .reduce((sum, p) => sum + p.amount, 0);
            
        const remaining = debt.total - paid;
        return {
            ...debt,
            paid: paid,
            remaining: remaining,
            isPaidOff: remaining <= 0.01
        };
    }).filter(d => d.remaining > 0); // Hanya tampilkan yang belum lunas
});


// Daftar yang tampil di tabel
const currentList = computed(() => {
    return activeTab.value === 'piutang' ? piutangList.value : hutangList.value;
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // Fetch 6 jenis transaksi terkait Hutang/Piutang
        const [sales, buys, arGlobal, apGlobal, paymentsAr, paymentsAp] = await Promise.all([
             journalService.findAllByType('SALE').catch(() => []),
             journalService.findAllByType('BUY').catch(() => []),
             journalService.findAllByType('AR').catch(() => []), // [BARU] AR Global
             journalService.findAllByType('AP').catch(() => []), // [BARU] AP Global
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
        
        debts.value = rawData
            .map(journal => {
            const detailsMap = journal.details.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {});

            const isCredit = detailsMap['is_credit'] === 'true';
            const type = journal.code.split('-')[0];

            let amount = 0;
            // Tentukan jumlah total
            if (isCredit) {
                // Untuk SALE/BUY Kredit
                amount = Number(detailsMap['grand_total'] || 0); 
            } else if (type === 'AR' || type === 'AP') {
                 // Untuk AR/AP Global
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
                isCredit: isCredit || type === 'AR' || type === 'AP', // Piutang/Hutang Global juga dianggap kredit/tagihan
                customer: detailsMap['customer_name'] || '-',
                supplier: detailsMap['supplier'] || '-',
                dueDate: detailsMap['due_date'] || null,
                refCode: detailsMap['reference_journal_code'] || null, // Kode nota yang dibayar
                method: detailsMap['payment_method'] || '-',
                notes: detailsMap['notes'] || '',
            };
        }).filter(d => d.total > 0 || d.refCode); // Filter data yang tidak relevan (misalnya journal kosong)

    } catch (e) {
        console.error("Gagal memuat data Hutang/Piutang", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Hutang/Piutang', life: 3000 });
        debts.value = [];
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS ---

const openPaymentModal = (debt) => {
    selectedDebt.value = debt;
    // Set default amount ke sisa tagihan
    paymentDetails.value.amount = debt.remaining;
    paymentDetails.value.notes = `Pembayaran ${activeTab.value === 'piutang' ? 'Piutang' : 'Hutang'} Nota ${debt.code}`;
    paymentDetails.value.method = 'CASH'; // Reset method
    showPaymentModal.value = true;
};

const processPayment = async () => {
    // Validasi dasar
    if (!selectedDebt.value || paymentDetails.value.amount <= 0 || paymentProcessing.value) return;

    // Tambahan validasi: Tidak boleh bayar lebih dari sisa
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
            // Tambahkan nama Customer/Supplier (penting untuk audit trail)
            ...(activeTab.value === 'piutang' ? { customer_name: selectedDebt.value.customer } : {}),
            ...(activeTab.value === 'hutang' ? { supplier: selectedDebt.value.supplier } : {}),
        };

        if (activeTab.value === 'piutang') {
            await journalService.createArPaymentTransaction({ details: payload });
        } else {
            await journalService.createApPaymentTransaction({ details: payload });
        }

        toast.add({ severity: 'success', summary: 'Pembayaran Sukses', detail: `Pembayaran ${formatCurrency(paymentDetails.value.amount)} telah dicatat.`, life: 5000 });
        
        showPaymentModal.value = false;
        await loadData(); // Muat ulang data untuk update status lunas
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan saat memproses pembayaran', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if(!dateString) return '-';
    // Gunakan toLocaleDateString tanpa waktu untuk jatuh tempo agar lebih ringkas
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

onMounted(() => {
    loadData();
});

const refreshData = async () => {
    await loadData();
}

defineExpose({ refreshData });
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-950 p-4">
        
        <div class="flex items-end gap-3 mb-4 border-b border-surface-200 dark:border-surface-700">
            <button 
                @click="activeTab = 'piutang'"
                :class="activeTab === 'piutang' ? 'global-tab-active !text-emerald-600 !border-emerald-600' : 'global-tab-inactive'"
            >
                <i class="pi pi-arrow-up-right mr-2"></i> Piutang Diterima (AR)
            </button>
            <button 
                @click="activeTab = 'hutang'"
                :class="activeTab === 'hutang' ? 'global-tab-active !text-red-600 !border-red-600' : 'global-tab-inactive'"
            >
                <i class="pi pi-arrow-down-left mr-2"></i> Hutang Dibayar (AP)
            </button>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" :placeholder="activeTab === 'piutang' ? 'Cari Nota / Pelanggan...' : 'Cari Nota / Supplier...'" class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <div class="flex gap-2">
                     <Button label="Refresh" icon="pi pi-refresh" severity="secondary" text size="small" @click="loadData" />
                </div>
            </div>

            <DataTable 
                :value="currentList" 
                dataKey="code"
                :loading="loading"
                paginator :rows="10" :rowsPerPageOptions="[10,20,50]"
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                class="text-sm"
                rowHover
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <i class="pi pi-file-excel text-4xl mb-2 opacity-50"></i>
                        <p>Tidak ada {{ activeTab === 'piutang' ? 'piutang' : 'hutang' }} yang aktif.</p>
                    </div>
                </template>

                <Column field="code" header="No. Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col py-1">
                            <span class="font-bold font-mono text-xs text-surface-700 dark:text-surface-200">
                                {{ slotProps.data.code }}
                            </span>
                            <div class="text-[11px] text-surface-500 mt-0.5">
                                Nota Awal: {{ formatDate(slotProps.data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column :field="activeTab === 'piutang' ? 'customer' : 'supplier'" :header="activeTab === 'piutang' ? 'Pelanggan/Debitur' : 'Supplier/Kreditur'" sortable>
                     <template #body="slotProps">
                        <span class="font-medium text-surface-700 dark:text-surface-200">{{ activeTab === 'piutang' ? slotProps.data.customer : slotProps.data.supplier }}</span>
                         <Tag v-if="slotProps.data.type === 'AR' || slotProps.data.type === 'AP'" value="GLOBAL" severity="secondary" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                    </template>
                </Column>

                <Column field="dueDate" header="Jatuh Tempo" sortable>
                    <template #body="slotProps">
                        <span :class="new Date(slotProps.data.dueDate) < new Date() ? 'text-red-500 font-bold' : 'text-surface-700'">
                             {{ formatDate(slotProps.data.dueDate) }}
                        </span>
                        <Tag v-if="new Date(slotProps.data.dueDate) < new Date()" value="JATUH TEMPO" severity="danger" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                    </template>
                </Column>
                
                <Column field="total" header="Total Tagihan" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-sm text-surface-800 dark:text-surface-100">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                 <Column field="paid" header="Sudah Dibayar" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-medium text-sm text-emerald-600">
                            {{ formatCurrency(slotProps.data.paid) }}
                        </span>
                    </template>
                </Column>

                 <Column field="remaining" header="Sisa Tagihan" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-black text-lg"
                            :class="activeTab === 'piutang' ? 'text-emerald-600' : 'text-red-600'"
                        >
                            {{ formatCurrency(slotProps.data.remaining) }}
                        </span>
                         <Tag v-if="slotProps.data.isPaidOff" value="LUNAS" severity="success" rounded class="!text-[9px] mt-1 !font-extrabold !px-1.5 w-fit" />
                    </template>
                </Column>

                <Column style="width: 4rem; text-align: center">
                    <template #body="slotProps">
                        <Button 
                            icon="pi pi-money-bill" 
                            :severity="activeTab === 'piutang' ? 'success' : 'danger'"
                            rounded 
                            size="small" 
                            v-tooltip.left="`Bayar ${activeTab === 'piutang' ? 'Piutang' : 'Hutang'}`"
                            @click="openPaymentModal(slotProps.data)"
                            :disabled="slotProps.data.isPaidOff"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="showPaymentModal" :header="`Pembayaran ${activeTab === 'piutang' ? 'Piutang' : 'Hutang'}`" :modal="true" class="w-11 md:w-3/5 lg:w-2/5">
            <div v-if="selectedDebt" class="p-fluid">
                <div class="mb-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs text-surface-500">Nota Referensi:</span>
                        <span class="font-bold text-sm">{{ selectedDebt.code }}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-surface-500">Sisa Tagihan:</span>
                        <span class="font-black text-lg" :class="activeTab === 'piutang' ? 'text-emerald-600' : 'text-red-600'">
                            {{ formatCurrency(selectedDebt.remaining) }}
                        </span>
                    </div>
                </div>

                <div class="field">
                    <label for="paymentAmount" class="font-bold text-sm">Jumlah Pembayaran</label>
                    <InputNumber 
                        id="paymentAmount" 
                        v-model="paymentDetails.amount" 
                        mode="currency" 
                        currency="IDR" 
                        locale="id-ID" 
                        :min="0"
                        :max="selectedDebt.remaining"
                        inputClass="!text-lg !font-mono"
                    />
                </div>

                <div class="field">
                    <label for="paymentMethod" class="font-bold text-sm">Metode Pembayaran</label>
                    <SelectButton 
                        v-model="paymentDetails.method" 
                        :options="[{label: 'Cash', value: 'CASH'}, {label: 'Transfer', value: 'TRANSFER'}, {label: 'Lainnya', value: 'OTHER'}]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        :pt="{ button: { class: '!text-xs !py-2' } }"
                    />
                </div>
                
                <div class="field">
                    <label for="notes" class="font-bold text-sm">Catatan (Opsional)</label>
                    <Textarea v-model="paymentDetails.notes" rows="2" class="w-full" />
                </div>
                
            </div>

            <template #footer>
                <Button 
                    :label="`Bayar ${formatCurrency(paymentDetails.amount)}`"
                    :icon="paymentProcessing ? 'pi pi-spin pi-spinner' : 'pi pi-check'" 
                    :severity="activeTab === 'piutang' ? 'success' : 'danger'"
                    @click="processPayment" 
                    :disabled="paymentDetails.amount <= 0 || paymentDetails.amount > selectedDebt.remaining || paymentProcessing"
                />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* Tab Styles (diambil dari global-tab-active/inactive di index.vue) */
.global-tab-active { @apply border-b-2 font-bold pb-2 px-3 text-sm transition-colors; }
.global-tab-inactive { @apply border-b-2 border-transparent text-surface-500 pb-2 px-3 text-sm hover:border-surface-300 transition-colors; }

/* Mengatasi latar belakang tabel utama */
:deep(.p-datatable) {
    background: transparent !important;
    border-color: transparent !important;
}

/* Mengatasi latar belakang header */
:deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-50) !important; 
    color: var(--p-text-color) !important;
    border-color: var(--p-surface-200) !important;
}

/* Memaksa warna header di Dark Mode */
.dark :deep(.p-datatable-thead > tr > th) {
    background-color: var(--p-surface-900) !important;
    color: var(--p-surface-100) !important;
    border-color: var(--p-surface-800) !important;
}

/* HOVER ROW FIX */
.dark :deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-800) !important; 
}
:deep(.p-datatable-tbody > tr:hover) {
    background-color: var(--p-surface-100) !important; 
}

/* Penyesuaian agar isi tabel rata atas */
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    vertical-align: top;
    border-color: var(--p-surface-200); /* Border Light */
}
.dark :deep(.p-datatable .p-datatable-tbody > tr > td) {
    border-color: var(--p-surface-800); /* Border Dark */
}
</style>