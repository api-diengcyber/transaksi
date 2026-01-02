<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

// Interfaces (bisa dipindah ke types/journal.ts agar lebih rapi)
interface Account { code: string; name: string; }
interface JournalConfig { transactionType: string; detailKey: string; position: 'DEBIT' | 'CREDIT'; account: Account; }
interface JournalDetail { key: string; value: string | number; }
interface Journal { uuid: string; code: string; createdAt: string; details: JournalDetail[]; }
interface LedgerEntry { account_code: string; account_name: string; debit: number; credit: number; }

// Services
const { findAll: fetchJournals } = useJournalService();
const { findAll: fetchConfigs } = useJournalConfigService();

// State
const journals = ref<Journal[]>([]);
const journalConfigs = ref<JournalConfig[]>([]); 
const loading = ref(false);
const expandedRows = ref([]);

// Filter Date
const now = new Date();
const startDate = ref(new Date(now.getFullYear(), now.getMonth(), 1));
const endDate = ref(new Date(now.getFullYear(), now.getMonth() + 1, 0));

// --- LOGIC MAPPING ---
const getLedgerEntries = (journalCode: string, rawDetails: any[]) => {
    const transactionType = journalCode.split('-')[0];
    const relevantConfigs = journalConfigs.value.filter(c => c.transactionType === transactionType);
    if (!relevantConfigs.length) return [];

    const ledgerLines: LedgerEntry[] = [];
    rawDetails.forEach((detail: any) => {
        const val = Number(detail.value) || 0;
        if (val <= 0) return;

        // Cari config yang cocok (Exact match atau Prefix match dengan underscore)
        const matches = relevantConfigs.filter(cfg => 
            cfg.detailKey === detail.key || (cfg.detailKey.endsWith('_') && detail.key.startsWith(cfg.detailKey))
        );

        matches.forEach(cfg => {
            ledgerLines.push({
                account_code: cfg.account?.code || '?',
                account_name: cfg.account?.name || '?',
                debit: cfg.position === 'DEBIT' ? val : 0,
                credit: cfg.position === 'CREDIT' ? val : 0,
            });
        });
    });

    // Grouping & Summing
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
        // Load Configs (untuk mapping display)
        const cfgRes = await fetchConfigs() as any;
        journalConfigs.value = (cfgRes.data || cfgRes || []) as JournalConfig[];

        // Load Jurnals
        const params = {
            startDate: startDate.value ? startDate.value.toISOString() : null,
            endDate: endDate.value ? endDate.value.toISOString() : null,
        };
        const jrnRes = await fetchJournals({ ...params, type: 'ALL' }) as any;
        journals.value = (jrnRes.data || (Array.isArray(jrnRes) ? jrnRes : [])) as Journal[];
    } catch (e) { console.error(e); } 
    finally { loading.value = false; }
};

const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
const formatDate = (val: string) => new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

onMounted(loadData);
watch([startDate, endDate], loadData);
</script>

<template>
    <div class="p-4">
        <div class="flex justify-end gap-2 mb-4 bg-surface-0 p-3 rounded shadow-sm border border-surface-200">
            <Calendar v-model="startDate" dateFormat="dd/mm/yy" showIcon class="w-36 p-inputtext-sm" placeholder="Mulai" />
            <span class="self-center text-surface-400">-</span>
            <Calendar v-model="endDate" dateFormat="dd/mm/yy" showIcon class="w-36 p-inputtext-sm" placeholder="Selesai" />
            <Button icon="pi pi-refresh" @click="loadData" rounded text />
        </div>

        <DataTable 
            v-model:expandedRows="expandedRows"
            :value="journals" 
            dataKey="uuid"
            paginator :rows="10"
            :loading="loading"
            class="p-datatable-sm shadow rounded-lg overflow-hidden bg-surface-0"
            stripedRows
        >
            <template #empty><div class="text-center py-8 text-surface-500">Tidak ada transaksi.</div></template>
            <Column expander style="width: 3rem" />
            <Column field="createdAt" header="Tanggal" sortable>
                <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
            </Column>
            <Column field="code" header="No. Bukti" sortable>
                <template #body="{ data }"><span class="font-mono font-bold text-primary-600">{{ data.code }}</span></template>
            </Column>
            <Column header="Tipe">
                <template #body="{ data }"><Tag :value="data.code.split('-')[0]" severity="info" /></template>
            </Column>
            <Column header="Status" class="text-center">
                <template #body="{ data }">
                    <Tag 
                        :severity="getLedgerEntries(data.code, data.details).length > 0 ? 'success' : 'danger'" 
                        :value="getLedgerEntries(data.code, data.details).length > 0 ? 'Mapped' : 'Unmapped'" 
                        class="text-xs"
                    />
                </template>
            </Column>

            <template #expansion="{ data }">
                <div class="p-4 bg-surface-50 border-y border-surface-200">
                    <h4 class="font-bold text-sm mb-2 text-surface-600">Rincian Ayat Jurnal</h4>
                    <DataTable :value="getLedgerEntries(data.code, data.details)" size="small">
                        <Column field="account_code" header="Kode Akun" />
                        <Column field="account_name" header="Nama Akun" />
                        <Column field="debit" header="Debit" class="text-right">
                            <template #body="{ data: l }"><span v-if="l.debit" class="font-bold">{{ formatCurrency(l.debit) }}</span></template>
                        </Column>
                        <Column field="credit" header="Kredit" class="text-right">
                            <template #body="{ data: l }"><span v-if="l.credit" class="font-bold">{{ formatCurrency(l.credit) }}</span></template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </DataTable>
    </div>
</template>