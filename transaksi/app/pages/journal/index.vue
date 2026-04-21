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
const { findAll: fetchJournals, createManual, remove: removeJournal } = useJournalService(); 
const { findAll: fetchConfigs } = useJournalConfigService();
const { getAll } = useAccountService();
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

// --- MODAL STATE ---
const isModalOpen = ref(false);
const isSubmitting = ref(false);
const form = ref({ date: new Date(), note: '' });
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

// --- LOGIC MAPPING ---
const processLedgerEntries = (journalCode: string, rawDetails: any[]): LedgerEntry[] => {
    const transactionType = journalCode.split('-')[0];

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
        const matchAcc = masterAccounts.value.find(acc => acc.code === e.code) || { code: e.code, name: e.name };
        return {
            account: matchAcc,
            debit: e.debit > 0 ? 0 : 0, 
            credit: e.credit > 0 ? 0 : 0
        };
    });
};

const addRow = () => formEntries.value.push({ account: null, debit: 0, credit: 0 });
const removeRow = (idx: number) => formEntries.value.splice(idx, 1);

const submitJournal = async () => {
    if (!isFormBalanced.value) return;
    
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
    <div class="p-6 flex flex-col h-full bg-slate-50/50 min-h-screen">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 flex items-center justify-center bg-white text-indigo-600 rounded-2xl shadow-sm border border-slate-200/60">
                    <i class="pi pi-book text-xl"></i>
                </div>
                <div>
                    <h2 class="text-xl font-bold text-slate-800">Jurnal Umum</h2>
                    <p class="text-sm text-slate-500 mt-0.5">Rekapitulasi dan input transaksi akuntansi</p>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div class="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex-1 md:flex-none">
                    <div class="pl-2 flex items-center gap-2 text-slate-400">
                        <i class="pi pi-calendar text-sm"></i>
                        <Calendar 
                            v-model="dates" 
                            selectionMode="range" 
                            dateFormat="dd M yy" 
                            :manualInput="false"
                            hideOnRangeSelection
                            class="w-48 p-inputtext-sm text-sm border-none bg-transparent shadow-none" 
                            placeholder="Pilih Periode"
                        />
                    </div>
                    <div class="h-6 w-px bg-slate-200 mx-1"></div>
                    <button 
                        @click="loadData" 
                        class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                        v-tooltip="'Refresh Data'"
                    >
                        <i :class="['pi pi-refresh', loading ? 'pi-spin' : '']"></i>
                    </button>
                </div>
                
                <button 
                    @click="openModal" 
                    class="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
                >
                    <i class="pi pi-plus"></i>
                    Buat Jurnal
                </button>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="journals" 
                dataKey="uuid"
                :loading="loading"
                paginator :rows="10"
                :rowsPerPageOptions="[10, 20, 50]"
                class="custom-datatable text-sm"
                rowHover
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-slate-400">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            <i class="pi pi-inbox text-2xl text-slate-300"></i>
                        </div>
                        <span class="text-sm font-medium text-slate-500">Tidak ada data jurnal pada periode ini.</span>
                    </div>
                </template>

                <Column expander style="width: 4rem" class="pl-4" />

                <Column field="createdAt" header="TANGGAL" sortable style="width: 15%">
                    <template #body="{ data }">
                        <span class="font-medium text-slate-700">{{ formatDate(data.createdAt) }}</span>
                    </template>
                </Column>

                <Column field="code" header="REFERENSI" sortable style="width: 25%">
                    <template #body="{ data }">
                        <div class="flex flex-col items-start gap-1.5">
                            <span class="font-mono text-sm font-semibold text-indigo-600">
                                {{ data.code }}
                            </span>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-slate-100 text-slate-500 uppercase">
                                {{ data.code.split('-')[0] }}
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="KETERANGAN" style="width: 25%">
                    <template #body="{ data }">
                        <span class="text-slate-600 text-sm line-clamp-2 leading-snug">
                            {{ data.note !== '-' ? data.note : 'Jurnal Sistem Otomatis' }}
                        </span>
                    </template>
                </Column>

                <Column header="TOTAL NILAI" class="text-right" style="width: 15%">
                    <template #body="{ data }">
                        <span class="font-mono font-bold text-slate-800">Rp {{ formatCurrency(data.totalAmount) }}</span>
                    </template>
                </Column>

                <Column header="AKSI" class="text-center" style="width: 10%">
                    <template #body="{ data }">
                        <button 
                            v-if="data.code.startsWith('MANUAL')" 
                            @click.stop="deleteJournal(data.uuid)"
                            class="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Hapus Jurnal Manual"
                        >
                            <i class="pi pi-trash"></i>
                        </button>
                        <div v-else class="flex justify-center">
                            <div v-if="data.isMapped" class="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500" v-tooltip="'Jurnal Sistem (Valid)'">
                                <i class="pi pi-check"></i>
                            </div>
                            <div v-else class="w-8 h-8 rounded-full flex items-center justify-center bg-amber-50 text-amber-500" v-tooltip="'Konfigurasi Akun Belum Lengkap'">
                                <i class="pi pi-exclamation-triangle"></i>
                            </div>
                        </div>
                    </template>
                </Column>

                <template #expansion="{ data }">
                    <div class="bg-slate-50/80 p-6 border-y border-slate-200 shadow-inner">
                        <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                            
                            <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Detail Buku Besar</span>
                                <span class="text-xs text-slate-400 font-mono">{{ data.code }}</span>
                            </div>

                            <div class="grid grid-cols-12 text-[11px] uppercase font-bold text-slate-400 py-3 px-6 border-b border-slate-200 bg-white">
                                <div class="col-span-2">Kode Akun</div>
                                <div class="col-span-6">Nama Akun</div>
                                <div class="col-span-2 text-right">Debit</div>
                                <div class="col-span-2 text-right">Kredit</div>
                            </div>

                            <div v-if="data.ledgerEntries.length > 0" class="bg-white">
                                <div v-for="(entry, idx) in data.ledgerEntries" :key="idx" 
                                    class="grid grid-cols-12 text-sm py-3 px-6 border-b border-slate-50 items-center hover:bg-slate-50/50 transition-colors group">
                                    <div class="col-span-2 font-mono text-slate-500">{{ entry.account_code }}</div>
                                    <div class="col-span-6 font-medium text-slate-700 flex items-center gap-2">
                                        <div v-if="entry.credit > 0" class="w-4 h-px bg-slate-300"></div> 
                                        {{ entry.account_name }}
                                    </div>
                                    <div class="col-span-2 text-right font-mono text-slate-700">{{ entry.debit > 0 ? formatCurrency(entry.debit) : '' }}</div>
                                    <div class="col-span-2 text-right font-mono text-slate-700">{{ entry.credit > 0 ? formatCurrency(entry.credit) : '' }}</div>
                                </div>
                                
                                <div class="grid grid-cols-12 bg-indigo-50/30 text-sm py-4 px-6 border-t border-slate-200">
                                    <div class="col-span-8 text-right pr-6 font-bold text-slate-600">Total</div>
                                    <div class="col-span-2 text-right font-mono font-bold text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                    <div class="col-span-2 text-right font-mono font-bold text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                </div>
                            </div>
                            <div v-else class="py-8 text-center text-slate-400 text-sm">
                                Belum ada jurnal akun yang terpetakan untuk transaksi ini.
                            </div>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>

        <Dialog v-model:visible="isModalOpen" header="Catat Jurnal Umum" :modal="true" :style="{ width: '850px' }" class="custom-dialog p-fluid">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Tanggal Transaksi</label>
                    <Calendar v-model="form.date" dateFormat="dd M yy" showIcon class="w-full shadow-sm" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Template Cepat (Opsional)</label>
                    <Dropdown 
                        v-model="selectedTemplate" 
                        :options="journalTemplates" 
                        optionLabel="label" 
                        placeholder="Pilih template untuk autofill" 
                        class="w-full shadow-sm"
                        @change="applyTemplate" 
                        showClear
                    />
                </div>
                <div class="col-span-1 md:col-span-2">
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Keterangan / Catatan</label>
                    <InputText v-model="form.note" placeholder="Tuliskan keterangan detail transaksi..." class="shadow-sm" />
                </div>
            </div>

            <div class="border border-slate-200 rounded-xl overflow-hidden mb-2">
                <table class="w-full text-sm text-left">
                    <thead class="bg-slate-100/80 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                        <tr>
                            <th class="px-5 py-3 w-[45%]">Pilih Akun</th>
                            <th class="px-4 py-3 w-[22%] text-right">Debit (Rp)</th>
                            <th class="px-4 py-3 w-[22%] text-right">Kredit (Rp)</th>
                            <th class="px-2 py-3 text-center w-[11%]"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="(row, idx) in formEntries" :key="idx" class="bg-white hover:bg-slate-50 transition-colors">
                            <td class="p-3">
                                <Dropdown 
                                    v-model="row.account" 
                                    :options="masterAccounts" 
                                    optionLabel="name" 
                                    filter 
                                    placeholder="Cari & Pilih Akun..." 
                                    class="w-full border-slate-200"
                                >
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex gap-2 items-center">
                                            <span class="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded">{{ slotProps.value.code }}</span>
                                            <span class="text-sm truncate">{{ slotProps.value.name }}</span>
                                        </div>
                                        <span v-else class="text-slate-400">{{ slotProps.placeholder }}</span>
                                    </template>
                                    <template #option="slotProps">
                                        <div class="flex items-center gap-2 py-1">
                                            <span class="font-mono text-xs font-bold text-slate-500 w-12">{{ slotProps.option.code }}</span>
                                            <span class="text-sm">{{ slotProps.option.name }}</span>
                                        </div>
                                    </template>
                                </Dropdown>
                            </td>
                            <td class="p-3">
                                <InputNumber v-model="row.debit" mode="decimal" class="w-full text-right !font-mono" :min="0" />
                            </td>
                            <td class="p-3">
                                <InputNumber v-model="row.credit" mode="decimal" class="w-full text-right !font-mono" :min="0" />
                            </td>
                            <td class="p-3 text-center">
                                <button 
                                    @click="removeRow(idx)" 
                                    :disabled="formEntries.length <= 2"
                                    class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                                >
                                    <i class="pi pi-times"></i>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot class="bg-slate-50 border-t border-slate-200">
                        <tr>
                            <td class="px-5 py-4">
                                <button 
                                    @click="addRow"
                                    class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <i class="pi pi-plus-circle"></i> Tambah Baris Akun
                                </button>
                            </td>
                            <td class="px-4 py-4 font-mono font-bold text-right text-lg" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-slate-800'">
                                {{ formatCurrency(totalFormDebit) }}
                            </td>
                            <td class="px-4 py-4 font-mono font-bold text-right text-lg" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-slate-800'">
                                {{ formatCurrency(totalFormCredit) }}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div v-if="totalFormDebit !== totalFormCredit" class="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 mt-4 animate-pulse">
                <i class="pi pi-exclamation-triangle text-xl"></i>
                <div class="text-sm">
                    <span class="font-bold">Saldo Tidak Seimbang!</span> Terdapat selisih 
                    <span class="font-mono font-bold">Rp {{ formatCurrency(Math.abs(totalFormDebit - totalFormCredit)) }}</span>. 
                    Pastikan Total Debit = Total Kredit.
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-3 pt-4">
                    <Button label="Batal" icon="pi pi-times" text class="!text-slate-500 hover:!bg-slate-100" @click="isModalOpen = false" />
                    <Button 
                        label="Simpan Jurnal" 
                        icon="pi pi-check" 
                        class="bg-indigo-600 hover:bg-indigo-700 border-none px-6 shadow-sm"
                        :loading="isSubmitting" 
                        :disabled="!isFormBalanced" 
                        @click="submitJournal" 
                    />
                </div>
            </template>
        </Dialog>

    </div>
</template>

<style scoped>
/* Reset PrimeVue default borders & backgrounds for inputs to match Tailwind closely */
:deep(.p-calendar .p-inputtext),
:deep(.p-dropdown),
:deep(.p-inputnumber .p-inputtext),
:deep(.p-inputtext) {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

:deep(.p-calendar .p-inputtext:focus),
:deep(.p-dropdown.p-focus),
:deep(.p-inputtext:focus) {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px #6366f1;
    outline: none;
}

/* Specific flat style for the header date picker */
:deep(.bg-transparent .p-inputtext) {
    border: none !important; 
    background: transparent !important; 
    box-shadow: none !important; 
    padding: 0; 
}

/* DataTable Customizations */
:deep(.custom-datatable .p-datatable-thead > tr > th) { 
    background: #f8fafc; 
    color: #64748b; 
    font-size: 0.75rem; 
    font-weight: 700;
    text-transform: uppercase; 
    padding: 1rem 1.25rem; 
    border-bottom: 1px solid #e2e8f0;
}
:deep(.custom-datatable .p-datatable-tbody > tr > td) {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
}
:deep(.p-datatable-row-expansion) { 
    padding: 0 !important; 
}

/* Paginator Fixes */
:deep(.p-paginator) {
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    padding: 1rem;
}
</style>