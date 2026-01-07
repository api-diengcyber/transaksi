<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';

// --- INTERFACES & TYPES ---
interface Account { code: string; name: string; }
interface JournalConfig { transactionType: string; detailKey: string; position: 'DEBIT' | 'CREDIT'; account: Account; }
interface JournalDetail { key: string; value: string | number; }
interface LedgerEntry { account_code: string; account_name: string; debit: number; credit: number; }

// Extend Journal type untuk menyimpan data hasil olahan (optimization)
interface Journal { 
    uuid: string; 
    code: string; 
    createdAt: string; 
    details: JournalDetail[]; 
    // Properti tambahan untuk UI agar tidak hitung ulang terus menerus
    ledgerEntries: LedgerEntry[];
    totalAmount: number;
    isMapped: boolean;
}

// --- SERVICES & STATE ---
const { findAll: fetchJournals } = useJournalService();
const { findAll: fetchConfigs } = useJournalConfigService();

const journals = ref<Journal[]>([]);
const journalConfigs = ref<JournalConfig[]>([]); 
const loading = ref(false);
const expandedRows = ref([]);

// Date Filter
const now = new Date();
const dates = ref<Date[]>([
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
]);

// --- LOGIC MAPPING (Core Accounting Logic) ---
const processLedgerEntries = (journalCode: string, rawDetails: any[]): LedgerEntry[] => {
    const transactionType = journalCode.split('-')[0];
    // Filter config yang relevan saja
    const relevantConfigs = journalConfigs.value.filter(c => c.transactionType === transactionType);
    if (!relevantConfigs.length) return [];

    const ledgerLines: LedgerEntry[] = [];
    
    rawDetails.forEach((detail: any) => {
        const val = Number(detail.value) || 0;
        if (val <= 0) return;

        // Matching Config: Exact Match OR Prefix Match (Wildcard '_')
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

    // Grouping by Account & Summing
    const grouped = ledgerLines.reduce<Record<string, LedgerEntry>>((acc, curr) => {
        const key = curr.account_code;
        if (!acc[key]) acc[key] = { ...curr, debit: 0, credit: 0 };
        acc[key].debit += curr.debit;
        acc[key].credit += curr.credit;
        return acc;
    }, {});

    // Sort: Debit first, then Credit
    return Object.values(grouped).sort((a, b) => b.debit - a.debit);
};

// --- DATA FETCHING ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Load Configs (Hanya sekali jika belum ada, atau force refresh)
        if (journalConfigs.value.length === 0) {
            const cfgRes = await fetchConfigs() as any;
            journalConfigs.value = (cfgRes.data || cfgRes || []) as JournalConfig[];
        }

        // 2. Prepare Date Params
        const [start, end] = dates.value;
        const params = {
            startDate: start ? start.toISOString() : null,
            endDate: end ? end.toISOString() : null,
        };

        // 3. Fetch Journals
        const jrnRes = await fetchJournals({ ...params, type: 'ALL' }) as any;
        const rawJournals = (jrnRes.data || (Array.isArray(jrnRes) ? jrnRes : [])) as any[];

        // 4. Pre-process Data (PENTING: Agar tidak lag saat render tabel)
        journals.value = rawJournals.map(j => {
            const entries = processLedgerEntries(j.code, j.details);
            // Hitung total debit saja (karena debit == kredit harusnya)
            const total = entries.reduce((sum, item) => sum + item.debit, 0);
            
            return {
                ...j,
                ledgerEntries: entries,
                totalAmount: total,
                isMapped: entries.length > 0
            };
        });

    } catch (e) { 
        console.error("Failed to load journals", e); 
    } finally { 
        loading.value = false; 
    }
};

// --- FORMATTERS ---
const formatCurrency = (val: number) => {
    if (!val) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(val);
};

const formatDate = (val: string) => {
    return new Date(val).toLocaleDateString('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
};

onMounted(loadData);
watch(dates, loadData); // React to date changes
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
                    <p class="text-xs text-gray-500">Rekapitulasi transaksi keuangan</p>
                </div>
            </div>

            <div class="flex items-center gap-2 bg-surface-0 p-1.5 rounded-xl border border-surface-200 shadow-sm">
                <div class="px-3 py-1.5 bg-gray-50 rounded-lg border border-surface-100 flex items-center gap-2">
                    <i class="pi pi-calendar text-gray-400 text-xs"></i>
                    <Calendar 
                        v-model="dates" 
                        selectionMode="range" 
                        dateFormat="dd M yy" 
                        :manualInput="false"
                        hideOnRangeSelection
                        class="w-52 p-inputtext-sm text-xs border-none bg-transparent" 
                        placeholder="Pilih Periode"
                    />
                </div>
                <button 
                    @click="loadData" 
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Refresh Data"
                >
                    <i :class="['pi pi-refresh', loading ? 'pi-spin' : '']"></i>
                </button>
            </div>
        </div>

        <DataTable 
            v-model:expandedRows="expandedRows"
            :value="journals" 
            dataKey="uuid"
            :loading="loading"
            paginator :rows="10"
            :rowsPerPageOptions="[10, 20, 50]"
            tableStyle="min-width: 50rem"
            class="p-datatable-sm text-sm border border-surface-200 rounded-xl overflow-hidden shadow-sm bg-surface-0"
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
                    <div class="flex flex-col">
                        <span class="font-semibold text-gray-700">{{ formatDate(data.createdAt).split(' ')[0] }} {{ formatDate(data.createdAt).split(' ')[1] }} {{ formatDate(data.createdAt).split(' ')[2] }}</span>
                        <span class="text-[10px] text-gray-400">{{ formatDate(data.createdAt).split(',')[1] }}</span>
                    </div>
                </template>
            </Column>

            <Column field="code" header="No. Referensi" sortable style="width: 25%">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <span class="font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-100">
                            {{ data.code }}
                        </span>
                    </div>
                </template>
            </Column>

            <Column header="Tipe Transaksi" field="code" style="width: 20%">
                <template #body="{ data }">
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-surface-200">
                        {{ data.code.split('-')[0] }}
                    </span>
                </template>
            </Column>

             <Column header="Total Nilai" class="text-right" style="width: 20%">
                <template #body="{ data }">
                    <span class="font-mono font-bold text-gray-700">Rp {{ formatCurrency(data.totalAmount) }}</span>
                </template>
            </Column>

            <Column header="Status" class="text-center" style="width: 10%">
                <template #body="{ data }">
                    <i v-if="data.isMapped" class="pi pi-check-circle text-emerald-500 text-lg" title="Terpetakan (Balanced)"></i>
                    <i v-else class="pi pi-exclamation-triangle text-amber-500 text-lg" title="Belum Terpetakan (Config Missing)"></i>
                </template>
            </Column>

            <template #expansion="{ data }">
                <div class="bg-gray-50/80 p-4 border-y border-gray-200 shadow-inner">
                    <div class="max-w-4xl mx-auto bg-surface-0 border border-surface-200 rounded-lg overflow-hidden shadow-sm">
                        <div class="grid grid-cols-12 bg-gray-100/50 text-[11px] uppercase tracking-wider font-bold text-gray-500 py-2 px-4 border-b border-gray-200">
                            <div class="col-span-2">Kode Akun</div>
                            <div class="col-span-6">Nama Akun (Keterangan)</div>
                            <div class="col-span-2 text-right">Debit</div>
                            <div class="col-span-2 text-right">Kredit</div>
                        </div>

                        <div v-if="data.ledgerEntries.length > 0">
                            <div 
                                v-for="(entry, idx) in data.ledgerEntries" 
                                :key="idx"
                                class="grid grid-cols-12 text-sm py-2.5 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors items-center"
                            >
                                <div class="col-span-2 font-mono text-xs text-gray-500">{{ entry.account_code }}</div>
                                
                                <div class="col-span-6 font-medium text-gray-700 flex items-center">
                                    <div v-if="entry.credit > 0" class="w-6 border-b border-gray-300 mr-2 opacity-50"></div> {{ entry.account_name }}
                                </div>

                                <div class="col-span-2 text-right font-mono text-gray-800">
                                    {{ entry.debit > 0 ? formatCurrency(entry.debit) : '' }}
                                </div>

                                <div class="col-span-2 text-right font-mono text-gray-800">
                                    {{ entry.credit > 0 ? formatCurrency(entry.credit) : '' }}
                                </div>
                            </div>

                            <div class="grid grid-cols-12 bg-gray-50 text-xs font-bold text-gray-700 py-2 px-4 border-t border-gray-200">
                                <div class="col-span-8 text-right pr-4">Total:</div>
                                <div class="col-span-2 text-right text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                <div class="col-span-2 text-right text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                            </div>
                        </div>

                        <div v-else class="p-6 text-center text-gray-400 italic text-sm">
                            Konfigurasi jurnal belum ditemukan untuk transaksi ini. 
                            <br>Nilai transaksi: <span class="not-italic font-mono text-gray-600">{{ data.details[0]?.value || 0 }}</span>
                        </div>
                    </div>
                </div>
            </template>
        </DataTable>
    </div>
</template>

<style scoped>
/* Override PrimeVue inputs to be cleaner */
:deep(.p-calendar .p-inputtext) {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0;
}
:deep(.p-datatable .p-datatable-thead > tr > th) {
    background: #f9fafb;
    color: #4b5563;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.75rem 1rem;
}
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    padding: 0.75rem 1rem;
    vertical-align: middle;
}
:deep(.p-datatable-row-expansion) {
    padding: 0 !important; /* Remove default padding to allow full-width background */
}
</style>