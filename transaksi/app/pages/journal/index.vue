<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';
import { useJournalService } from '~/composables/useJournalService';
import JournalCreateModal from '~/components/journal/JournalCreateModal.vue';

const router = useRouter(); 
const { findAll: fetchJournals, remove: removeJournal } = useJournalService(); 
const toast = useToast();

const journals = ref<any[]>([]);
const loading = ref(false);
const expandedRows = ref({});

const showCreateModal = ref(false);

const pagination = ref({ page: 1, limit: 15 });
const totalRecords = ref(0);
const searchQuery = ref('');
const activeTab = ref<'ALL' | 'MANUAL' | 'SYSTEM'>('ALL');

const now = new Date();
const dates = ref<Date[]>([
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
]);

// --- LOAD DATA (Paginasi langsung dari Backend) ---
const loadData = async () => {
    loading.value = true;
    try {
        const [start, end] = dates.value;
        const response = await fetchJournals({ 
            page: pagination.value.page,
            limit: pagination.value.limit,
            search: searchQuery.value,
            startDate: start ? start.toISOString().split('T')[0] : undefined, 
            endDate: end ? end.toISOString().split('T')[0] : undefined, 
            generalType: activeTab.value 
        }) as any;
        
        const resData = response || response?.data || {};
        
        journals.value = resData.data || [];
        if (resData.meta) {
            totalRecords.value = resData.meta.total;
        }

    } catch (e) { 
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data jurnal', life: 3000 });
    } finally { 
        loading.value = false; 
    }
};

// --- EVENT HANDLERS ---
const onPage = (event: any) => {
    pagination.value.page = event.page + 1;
    pagination.value.limit = event.rows;
    loadData();
};

let searchTimeout: any = null;
const onSearch = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        pagination.value.page = 1; 
        loadData();
    }, 600); 
};

// --- DELETE ---
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

// --- UTILS ---
const isManualJournal = (code: string) => code.startsWith('MANUAL') || code.startsWith('MAN_');
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
const formatDate = (val: string) => new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// --- WATCHERS ---
watch(dates, (newDates) => {
    if (!newDates || (newDates[0] && newDates[1])) {
        pagination.value.page = 1;
        loadData();
    }
});

watch(activeTab, () => {
    pagination.value.page = 1;
    loadData();
});

onMounted(() => loadData());
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <i class="pi pi-book text-lg"></i>
                    </div>
                    Jurnal Umum
                </h1>
                <p class="text-sm text-surface-500 mt-1">Rekapitulasi dan input transaksi akuntansi secara manual & sistem.</p>
            </div>
            
            <div class="flex flex-wrap gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Catat Jurnal Manual" icon="pi pi-plus" severity="primary" size="small" @click="showCreateModal = true" class="!bg-indigo-600 !border-indigo-600 !rounded-xl shadow-sm" />
                <Button label="Setting Jurnal" icon="pi pi-cog" severity="secondary" size="small" @click="router.push('/journal/setting')" class="!rounded-xl shadow-sm bg-white border-surface-200" />
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden flex-1 flex flex-col">
            
            <div class="flex flex-col xl:flex-row items-start sm:items-center justify-between gap-4 p-3 border-b border-surface-100 bg-surface-50/50">
                <div class="flex items-center gap-1 bg-surface-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto shrink-0">
                    <button @click="activeTab = 'ALL'" class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap" :class="activeTab === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'">Semua Jurnal</button>
                    <button @click="activeTab = 'MANUAL'" class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap" :class="activeTab === 'MANUAL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'">Jurnal Manual</button>
                    <button @click="activeTab = 'SYSTEM'" class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap" :class="activeTab === 'SYSTEM' ? 'bg-white text-indigo-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'">Jurnal Sistem</button>
                </div>
                
                <div class="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    <div class="relative w-full sm:w-72">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                        <input v-model="searchQuery" @input="onSearch" type="text" placeholder="Cari No. Referensi..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                    </div>
                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <DatePicker v-model="dates" selectionMode="range" :manualInput="false" dateFormat="dd M yy" showIcon class="w-full sm:w-56 custom-datepicker" inputClass="!py-1.5 !text-sm !rounded-xl" placeholder="Pilih Periode" />
                    </div>
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="journals" 
                dataKey="uuid"
                :loading="loading"
                lazy
                paginator :rows="pagination.limit"
                :totalRecords="totalRecords"
                :rowsPerPageOptions="[15, 30, 50]"
                @page="onPage"
                stripedRows rowHover responsiveLayout="scroll"
                class="p-datatable-sm flex-1 text-sm border-none"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-surface-400">
                        <div class="w-16 h-16 bg-surface-50 rounded-full flex items-center justify-center mb-4 border border-surface-100"><i class="pi pi-inbox text-2xl text-surface-300"></i></div>
                        <span class="text-sm font-medium text-surface-500">Tidak ada data jurnal pada filter/tab ini.</span>
                    </div>
                </template>

                <Column expander style="width: 3rem" class="pl-4" />

                <Column field="createdAt" header="TANGGAL" sortable style="width: 15%">
                    <template #body="{ data }">
                        <span class="font-medium text-surface-700">{{ formatDate(data.createdAt) }}</span>
                    </template>
                </Column>

                <Column field="code" header="REFERENSI" sortable style="width: 25%">
                    <template #body="{ data }">
                        <div class="flex flex-col items-start gap-1">
                            <div v-if="isManualJournal(data.code)">
                                <span class="inline-flex px-2 py-0.5 rounded text-[12px] font-bold bg-primary-100 text-primary-500 uppercase">{{ data.code.split('-')[0].split('_')[0] }}</span>
                                <div class="text-[8px] text-surface-500 uppercase">{{ data.code }}</div>
                            </div>
                            <div v-else>
                                <span class="inline-flex px-2 py-0.5 rounded text-[12px] font-bold bg-amber-100 text-amber-500 uppercase">{{ data.code.split('-')[0].split('_')[0] }}</span>
                                <div class="text-[8px] text-surface-500 uppercase">{{ data.code }}</div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="KETERANGAN / JUDUL" style="width: 25%">
                    <template #body="{ data }">
                        <span class="text-surface-600 text-sm line-clamp-2 leading-snug">{{ data.note !== '-' ? data.note : 'Jurnal Sistem Otomatis' }}</span>
                    </template>
                </Column>

                <Column header="TOTAL NILAI" alignFrozen="right" style="width: 15%" class="text-right">
                    <template #body="{ data }">
                        <span v-if="data.totalAmount !== null" class="font-mono font-bold text-surface-800">
                            {{ formatCurrency(data.totalAmount) }}
                        </span>
                        <div v-else class="flex flex-col items-end">
                            <span class="text-[11px] text-amber-500 font-bold italic border-b border-amber-200">Belum diset settingannya</span>
                            <button @click="router.push('/journal/setting')" class="text-[9px] text-indigo-500 mt-1 hover:underline">Atur Sekarang</button>
                        </div>
                    </template>
                </Column>

                <Column header="AKSI" alignFrozen="right" class="text-center" style="width: 10%">
                    <template #body="{ data }">
                        <button v-if="isManualJournal(data.code)" @click.stop="deleteJournal(data.uuid)" class="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors mx-auto" v-tooltip="'Hapus Jurnal'"><i class="pi pi-trash"></i></button>
                        <div v-else class="flex justify-center">
                            <div v-if="data.isMapped" class="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500" v-tooltip="'Sistem: Valid'"><i class="pi pi-check"></i></div>
                            <div v-else class="w-8 h-8 rounded-full flex items-center justify-center bg-amber-50 text-amber-500" v-tooltip="'Sistem: Config Akun Belum Lengkap'"><i class="pi pi-exclamation-triangle"></i></div>
                        </div>
                    </template>
                </Column>

                <template #expansion="{ data }">
                    <div class="bg-surface-50/80 p-6 border-y border-surface-200 shadow-inner">
                        <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden relative">
                            <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

                            <div class="px-6 py-4 border-b border-surface-100 flex justify-between items-center bg-surface-50/50">
                                <span class="text-xs font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2"><i class="pi pi-list"></i> Detail Buku Besar</span>
                                <span class="text-xs text-surface-400 font-mono">{{ data.code }}</span>
                            </div>

                            <div class="grid grid-cols-12 text-[11px] uppercase font-bold text-surface-400 py-3 px-6 border-b border-surface-200 bg-white">
                                <div class="col-span-2">Kode Akun</div>
                                <div class="col-span-6">Nama Akun</div>
                                <div class="col-span-2 text-right">Debit</div>
                                <div class="col-span-2 text-right">Kredit</div>
                            </div>

                            <div v-if="data.ledgerEntries && data.ledgerEntries.length > 0" class="bg-white">
                                <div v-for="(entry, idx) in data.ledgerEntries" :key="idx" class="grid grid-cols-12 text-sm py-3 px-6 border-b border-surface-50 items-center hover:bg-surface-50/50 transition-colors">
                                    <div class="col-span-2 font-mono text-surface-500">{{ entry.account_code }}</div>
                                    <div class="col-span-6 font-medium text-surface-700 flex items-center gap-2">
                                        <div v-if="entry.credit > 0" class="w-4 h-px bg-surface-300"></div> 
                                        {{ entry.account_name }}
                                    </div>
                                    <div class="col-span-2 text-right font-mono text-surface-700">{{ entry.debit > 0 ? formatCurrency(entry.debit) : '' }}</div>
                                    <div class="col-span-2 text-right font-mono text-surface-700">{{ entry.credit > 0 ? formatCurrency(entry.credit) : '' }}</div>
                                </div>
                                <div class="grid grid-cols-12 bg-indigo-50/30 text-sm py-4 px-6 border-t border-surface-200">
                                    <div class="col-span-8 text-right pr-6 font-bold text-surface-600">Total Balance</div>
                                    <div class="col-span-2 text-right font-mono font-bold text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                    <div class="col-span-2 text-right font-mono font-bold text-indigo-700">{{ formatCurrency(data.totalAmount) }}</div>
                                </div>
                            </div>
                            <div v-else class="py-8 text-center text-amber-500 text-sm flex flex-col items-center gap-2">
                                <i class="pi pi-exclamation-circle text-3xl mb-2"></i>
                                <span>Belum ada konfigurasi jurnal akun untuk transaksi jenis ini.</span>
                                <Button label="Atur Konfigurasi Sekarang" severity="info" size="small" outlined @click="router.push('/journal/setting')" />
                            </div>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>

        <JournalCreateModal v-model:visible="showCreateModal" @saved="loadData" />

    </div>
</template>

<style scoped>
:deep(.p-datatable-row-expansion) { padding: 0 !important; }
</style>