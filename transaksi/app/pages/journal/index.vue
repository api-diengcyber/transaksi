<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// --- INTERFACES & TYPES ---
interface Account { code: string; name: string; uuid?: string }
interface JournalConfig { transactionType: string; detailKey: string; position: 'DEBIT' | 'CREDIT'; account: Account; }
interface JournalDetail { key: string; value: string | number; }
interface LedgerEntry { account_code: string; account_name: string; debit: number; credit: number; }

interface Journal { 
    uuid: string; 
    code: string; 
    createdAt: string; 
    details: JournalDetail[]; 
    ledgerEntries: LedgerEntry[];
    totalAmount: number;
    isMapped: boolean;
    note?: string;
}

// --- SERVICES & STATE --- //
// Mengambil fungsi CRUD dari useJournalService
const { 
    findAll: fetchJournals, 
    createManual, 
    remove: removeJournal 
} = useJournalService(); 

const { findAll: fetchConfigs } = useJournalConfigService();
const { getAll } = useAccountService(); // Memanggil master akun
const toast = useToast();

const journals = ref<Journal[]>([]);
const journalConfigs = ref<JournalConfig[]>([]); 
const masterAccounts = ref<Account[]>([]);
const loading = ref(false);
const expandedRows = ref([]);

// Date Filter
const now = new Date();
const dates = ref<Date[]>([
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
]);

// --- MODAL STATE (BUAT JURNAL UMUM) ---
const isModalOpen = ref(false);
const isSubmitting = ref(false);
const form = ref({
    date: new Date(),
    note: '',
});
const formEntries = ref<{ account: Account | null; debit: number; credit: number }[]>([
    { account: null, debit: 0, credit: 0 },
    { account: null, debit: 0, credit: 0 }
]);

// TEMPLATES
const selectedTemplate = ref(null);
const journalTemplates = [
    { label: 'Penggajian Karyawan', entries: [{ code: '5100', name: 'Beban Gaji', debit: 1, credit: 0 }, { code: '1100', name: 'Kas/Bank', debit: 0, credit: 1 }] },
    { label: 'Pembelian Aset (Kas)', entries: [{ code: '1200', name: 'Aset Tetap', debit: 1, credit: 0 }, { code: '1100', name: 'Kas/Bank', debit: 0, credit: 1 }] },
    { label: 'Penyusutan Aset', entries: [{ code: '6100', name: 'Beban Penyusutan', debit: 1, credit: 0 }, { code: '1250', name: 'Akumulasi Penyusutan', debit: 0, credit: 1 }] },
];

const totalFormDebit = computed(() => formEntries.value.reduce((sum, e) => sum + (e.debit || 0), 0));
const totalFormCredit = computed(() => formEntries.value.reduce((sum, e) => sum + (e.credit || 0), 0));
const isFormBalanced = computed(() => totalFormDebit.value === totalFormCredit.value && totalFormDebit.value > 0);

// --- LOGIC MAPPING (Core Accounting Logic) ---
const processLedgerEntries = (journalCode: string, rawDetails: any[]): LedgerEntry[] => {
    const transactionType = journalCode.split('-')[0];

    // MAPPING UNTUK JURNAL MANUAL
    if (transactionType === 'MANUAL') {
        const manualEntriesStr = rawDetails.find(d => d.key === 'manual_entries')?.value;
        if (manualEntriesStr) {
            try {
                const parsed = JSON.parse(manualEntriesStr);
                return parsed.map((e: any) => ({
                    account_code: e.accountCode,
                    account_name: e.accountName,
                    debit: Number(e.debit),
                    credit: Number(e.credit)
                }));
            } catch (err) { console.error(err); return []; }
        }
    }

    // MAPPING UNTUK SISTEM TRANSAKSI OTOMATIS (SALE/BUY/AP/AR)
    const relevantConfigs = journalConfigs.value.filter(c => c.transactionType === transactionType);
    if (!relevantConfigs.length) return [];

    const ledgerLines: LedgerEntry[] = [];
    rawDetails.forEach((detail: any) => {
        const val = Number(detail.value) || 0;
        if (val <= 0) return;

        const matches = relevantConfigs.filter(cfg => 
            cfg.detailKey === detail.key || (cfg.detailKey.endsWith('_') && detail.key.startsWith(cfg.detailKey))
        );

        matches.forEach(cfg => {
            ledgerLines.push({
                account_code: cfg.account?.code || '???',
                account_name: cfg.account?.name || 'Unknown Account',
                debit: cfg.position === 'DEBIT' ? val : 0,
                credit: cfg.position === 'CREDIT' ? val : 0,
            });
        });
    });

    const grouped = ledgerLines.reduce<Record<string, LedgerEntry>>((acc, curr) => {
        const key = curr.account_code;
        if (!acc[key]) acc[key] = { ...curr, debit: 0, credit: 0 };
        acc[key].debit += curr.debit;
        acc[key].credit += curr.credit;
        return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.debit - a.debit);
};

// --- DATA FETCHING ---
const loadData = async () => {
    loading.value = true;
    try {
        if (journalConfigs.value.length === 0) {
            const cfgRes = await fetchConfigs() as any;
            journalConfigs.value = (cfgRes.data || cfgRes || []) as JournalConfig[];
        }
        if (masterAccounts.value.length === 0) {
            const accRes = await getAll() as any;
            masterAccounts.value = (accRes.data || accRes || []) as Account[];
        }

        const [start, end] = dates.value;
        const jrnRes = await fetchJournals({ 
            startDate: start ? start.toISOString() : null, 
            endDate: end ? end.toISOString() : null, 
            type: 'ALL' 
        }) as any;
        
        const rawJournals = (jrnRes.data || (Array.isArray(jrnRes) ? jrnRes : [])) as any[];

        journals.value = rawJournals.map(j => {
            const entries = processLedgerEntries(j.code, j.details);
            const total = entries.reduce((sum, item) => sum + item.debit, 0);
            const noteEntry = j.details.find((d: any) => d.key === 'note');
            
            return {
                ...j,
                ledgerEntries: entries,
                totalAmount: total,
                isMapped: entries.length > 0,
                note: noteEntry ? noteEntry.value : '-'
            };
        });
    } catch (e) { 
        console.error("Failed to load journals", e); 
    } finally { 
        loading.value = false; 
    }
};

// --- FORM ACTION LOGIC ---
const openModal = () => {
    form.value = { date: new Date(), note: '' };
    formEntries.value = [{ account: null, debit: 0, credit: 0 }, { account: null, debit: 0, credit: 0 }];
    selectedTemplate.value = null;
    isModalOpen.value = true;
};

const applyTemplate = () => {
    if (!selectedTemplate.value) return;
    const tpl = selectedTemplate.value as any;
    formEntries.value = tpl.entries.map((e: any) => {
        // Cari akun asli dari master database berdasarkan code/name template
        const matchAcc = masterAccounts.value.find(acc => acc.code === e.code) || { code: e.code, name: e.name };
        return {
            account: matchAcc,
            debit: e.debit > 0 ? 0 : 0, // Set 0, biarkan user isi nominal
            credit: e.credit > 0 ? 0 : 0
        };
    });
};

const addRow = () => formEntries.value.push({ account: null, debit: 0, credit: 0 });
const removeRow = (idx: number) => formEntries.value.splice(idx, 1);

const submitJournal = async () => {
    if (!isFormBalanced.value) return;
    
    // Validasi akun kosong
    const invalidEntry = formEntries.value.find(e => !e.account);
    if (invalidEntry) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Ada baris yang belum dipilih akunnya.', life: 3000 });
        return;
    }

    const payload = {
        date: form.value.date.toISOString(),
        note: form.value.note,
        entries: formEntries.value.map(e => ({
            accountCode: e.account!.code,
            accountName: e.account!.name,
            debit: e.debit,
            credit: e.credit
        }))
    };

    isSubmitting.value = true;
    try {
        // MENGGUNAKAN SERVICE: createManual
        await createManual(payload);
        
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Jurnal Umum berhasil disimpan.', life: 3000 });
        isModalOpen.value = false;
        loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat menyimpan.', life: 3000 });
    } finally {
        isSubmitting.value = false;
    }
};

const deleteJournal = async (uuid: string) => {
    if(!confirm('Apakah Anda yakin ingin menghapus jurnal ini? Tindakan ini akan membalikkan catatan buku besar.')) return;
    
    try {
        // MENGGUNAKAN SERVICE: remove
        await removeJournal(uuid);
        
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Jurnal berhasil dihapus.', life: 3000 });
        loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Tidak dapat menghapus jurnal.', life: 3000 });
    }
};

// --- FORMATTERS ---
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(val || 0);
const formatDate = (val: string) => new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

onMounted(loadData);
watch(dates, loadData); 
</script>

<template>
    <div class="flex flex-col h-full bg-surface-0 rounded-xl">
        
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 p-1">
            <div class="flex items-center gap-2">
                <div class="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    <i class="pi pi-book text-lg"></i>
                </div>
                <div>
                    <h3 class="font-bold text-sm">Jurnal Umum</h3>
                    <p class="text-xs text-gray-500">Rekapitulasi dan Input Transaksi Keuangan</p>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <Button 
                    icon="pi pi-plus" 
                    label="Buat Jurnal" 
                    class="p-button-sm p-button-indigo shadow-sm !text-xs !py-2" 
                    @click="openModal" 
                />
                <div class="flex items-center gap-2 bg-surface-0 p-1 rounded-xl border border-surface-200 shadow-sm ml-2">
                    <div class="px-2 py-1 bg-gray-50 rounded-lg flex items-center gap-2">
                        <i class="pi pi-calendar text-gray-400 text-xs"></i>
                        <Calendar 
                            v-model="dates" 
                            selectionMode="range" 
                            dateFormat="dd M yy" 
                            :manualInput="false"
                            hideOnRangeSelection
                            class="w-48 p-inputtext-sm text-xs border-none bg-transparent" 
                            placeholder="Periode"
                        />
                    </div>
                    <button 
                        @click="loadData" 
                        class="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Refresh"
                    >
                        <i :class="['pi pi-refresh', loading ? 'pi-spin' : '']"></i>
                    </button>
                </div>
            </div>
        </div>

        <DataTable 
            v-model:expandedRows="expandedRows"
            :value="journals" 
            dataKey="uuid"
            :loading="loading"
            paginator :rows="10"
            :rowsPerPageOptions="[10, 20, 50]"
            class="p-datatable-sm text-sm border border-surface-200 rounded-xl overflow-hidden shadow-sm"
            rowHover
        >
            <template #empty>
                <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                    <i class="pi pi-inbox text-4xl mb-2 opacity-50"></i>
                    <span class="text-sm">Tidak ada data jurnal pada periode ini.</span>
                </div>
            </template>

            <Column expander style="width: 3rem" />

            <Column field="createdAt" header="Tanggal" sortable style="width: 15%">
                <template #body="{ data }">
                    <span class="font-semibold text-gray-700">{{ formatDate(data.createdAt) }}</span>
                </template>
            </Column>

            <Column field="code" header="No. Referensi / Tipe" sortable style="width: 25%">
                <template #body="{ data }">
                    <div class="flex flex-col gap-1 items-start">
                        <span class="font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-100">
                            {{ data.code }}
                        </span>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 uppercase">
                            {{ data.code.split('-')[0] }}
                        </span>
                    </div>
                </template>
            </Column>

            <Column header="Keterangan" style="width: 25%">
                <template #body="{ data }">
                    <span class="text-gray-600 text-xs line-clamp-2">{{ data.note !== '-' ? data.note : 'Jurnal Sistem' }}</span>
                </template>
            </Column>

             <Column header="Total Nilai" class="text-right" style="width: 15%">
                <template #body="{ data }">
                    <span class="font-mono font-bold text-gray-700">Rp {{ formatCurrency(data.totalAmount) }}</span>
                </template>
            </Column>

            <Column header="Aksi" class="text-center" style="width: 10%">
                <template #body="{ data }">
                    <Button 
                        v-if="data.code.startsWith('MANUAL')" 
                        icon="pi pi-trash" 
                        severity="danger" 
                        text rounded 
                        aria-label="Hapus" 
                        @click="deleteJournal(data.uuid)" 
                    />
                    <i v-else-if="data.isMapped" class="pi pi-check-circle text-emerald-500 text-lg" title="Sistem"></i>
                    <i v-else class="pi pi-exclamation-triangle text-amber-500 text-lg" title="Error Config"></i>
                </template>
            </Column>

            <template #expansion="{ data }">
                <div class="bg-gray-50 p-4 border-y border-gray-200">
                    <div class="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <div class="grid grid-cols-12 bg-gray-100 text-[11px] uppercase font-bold text-gray-500 py-2 px-4 border-b">
                            <div class="col-span-2">Kode Akun</div>
                            <div class="col-span-6">Nama Akun</div>
                            <div class="col-span-2 text-right">Debit</div>
                            <div class="col-span-2 text-right">Kredit</div>
                        </div>

                        <div v-if="data.ledgerEntries.length > 0">
                            <div v-for="(entry, idx) in data.ledgerEntries" :key="idx" class="grid grid-cols-12 text-xs py-2 px-4 border-b border-gray-50 items-center">
                                <div class="col-span-2 font-mono text-gray-500">{{ entry.account_code }}</div>
                                <div class="col-span-6 font-medium text-gray-700">
                                    <span v-if="entry.credit > 0" class="inline-block w-4"></span> {{ entry.account_name }}
                                </div>
                                <div class="col-span-2 text-right font-mono">{{ entry.debit > 0 ? formatCurrency(entry.debit) : '' }}</div>
                                <div class="col-span-2 text-right font-mono">{{ entry.credit > 0 ? formatCurrency(entry.credit) : '' }}</div>
                            </div>
                            <div class="grid grid-cols-12 bg-gray-50 text-xs font-bold text-gray-800 py-2 px-4 border-t">
                                <div class="col-span-8 text-right pr-4">Total:</div>
                                <div class="col-span-2 text-right text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                <div class="col-span-2 text-right text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </DataTable>

        <Dialog v-model:visible="isModalOpen" header="Buat Jurnal Umum Manual" :modal="true" :style="{ width: '800px' }" class="p-fluid">
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Tanggal Transaksi</label>
                    <Calendar v-model="form.date" dateFormat="dd M yy" showIcon class="w-full" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Pilih Template (Opsional)</label>
                    <Dropdown 
                        v-model="selectedTemplate" 
                        :options="journalTemplates" 
                        optionLabel="label" 
                        placeholder="Pilih Template Cepat" 
                        class="w-full"
                        @change="applyTemplate" 
                        showClear
                    />
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Catatan / Keterangan</label>
                    <InputText v-model="form.note" placeholder="Contoh: Pembayaran gaji bulan berjalan..." />
                </div>
            </div>

            <div class="border border-gray-200 rounded-lg overflow-hidden mt-6">
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-100 text-gray-600 text-xs uppercase">
                        <tr>
                            <th class="px-4 py-2 w-1/2">Pilih Akun</th>
                            <th class="px-4 py-2 w-1/5">Debit</th>
                            <th class="px-4 py-2 w-1/5">Kredit</th>
                            <th class="px-4 py-2 text-center w-[50px]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, idx) in formEntries" :key="idx" class="border-t border-gray-100">
                            <td class="p-2">
                                <Dropdown 
                                    v-model="row.account" 
                                    :options="masterAccounts" 
                                    optionLabel="name" 
                                    filter 
                                    placeholder="Cari Akun..." 
                                    class="w-full text-xs"
                                >
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex gap-2 items-center">
                                            <span class="font-mono text-xs text-gray-500">{{ slotProps.value.code }}</span>
                                            <span class="text-xs">{{ slotProps.value.name }}</span>
                                        </div>
                                        <span v-else>{{ slotProps.placeholder }}</span>
                                    </template>
                                    <template #option="slotProps">
                                        <div class="flex flex-col">
                                            <span class="font-bold text-xs">{{ slotProps.option.code }} - {{ slotProps.option.name }}</span>
                                        </div>
                                    </template>
                                </Dropdown>
                            </td>
                            <td class="p-2">
                                <InputNumber v-model="row.debit" inputId="currency-id" mode="currency" currency="IDR" locale="id-ID" class="w-full" :min="0" />
                            </td>
                            <td class="p-2">
                                <InputNumber v-model="row.credit" inputId="currency-id" mode="currency" currency="IDR" locale="id-ID" class="w-full" :min="0" />
                            </td>
                            <td class="p-2 text-center">
                                <Button icon="pi pi-times" severity="danger" text rounded @click="removeRow(idx)" :disabled="formEntries.length <= 2" />
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="bg-gray-50 border-t border-gray-200">
                        <tr>
                            <td class="px-4 py-3">
                                <Button label="Tambah Baris" icon="pi pi-plus" text class="!p-0 !text-xs font-bold" @click="addRow" />
                            </td>
                            <td class="px-4 py-3 font-mono font-bold text-right" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-emerald-600'">
                                Rp {{ formatCurrency(totalFormDebit) }}
                            </td>
                            <td class="px-4 py-3 font-mono font-bold text-right" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-emerald-600'">
                                Rp {{ formatCurrency(totalFormCredit) }}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div v-if="totalFormDebit !== totalFormCredit" class="text-red-500 text-xs italic mt-2 text-right">
                Total Debit dan Kredit tidak seimbang! Selisih: Rp {{ formatCurrency(Math.abs(totalFormDebit - totalFormCredit)) }}
            </div>

            <template #footer>
                <Button label="Batal" icon="pi pi-times" text class="p-button-secondary" @click="isModalOpen = false" />
                <Button label="Simpan Jurnal" icon="pi pi-check" :loading="isSubmitting" :disabled="!isFormBalanced" @click="submitJournal" autofocus />
            </template>
        </Dialog>

    </div>
</template>

<style scoped>
:deep(.p-calendar .p-inputtext) { border: none !important; background: transparent !important; box-shadow: none !important; padding: 0; }
:deep(.p-datatable .p-datatable-thead > tr > th) { background: #f9fafb; color: #4b5563; font-size: 0.75rem; text-transform: uppercase; padding: 0.75rem 1rem; }
:deep(.p-datatable-row-expansion) { padding: 0 !important; }
</style>