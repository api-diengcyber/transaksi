<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

// --- Interfaces ---
interface Account { 
    uuid: string; 
    code: string; 
    name: string; 
}

interface DiscoveredItem {
    transactionType: string;
    detailKey: string;
    frequency: number;
    isMapped: boolean;
    mappedAccount?: string;
    mappedPosition?: string;
    configUuid?: string;
}

interface JournalConfigPayload {
    transactionType: string;
    detailKey: string;
    position: 'DEBIT' | 'CREDIT';
    accountUuid: string;
}

// --- Services ---
const { getDiscovery, create: createConfig, remove: removeConfig } = useJournalConfigService();
const { getAll: fetchAccounts } = useAccountService();

// --- State ---
const discoveryItems = ref<DiscoveredItem[]>([]);
const accounts = ref<Account[]>([]);
const loading = ref(false);
const isDialogVisible = ref(false);

// Form State
const form = ref<JournalConfigPayload>({
    transactionType: '',
    detailKey: '',
    position: 'DEBIT',
    accountUuid: ''
});
const mappingMode = ref<'EXACT' | 'PATTERN'>('EXACT');

// Filter Table
const filters = ref({
    global: { value: null, matchMode: 'contains' },
});

// --- Actions ---
const loadData = async () => {
    loading.value = true;
    try {
        const [discRes, accRes] = await Promise.all([ getDiscovery(), fetchAccounts() ]) as any[];
        discoveryItems.value = (discRes.data || discRes || []) as DiscoveredItem[];
        accounts.value = (accRes.data || accRes || []) as Account[];
    } catch (e) {
        console.error("Gagal memuat data discovery", e);
    } finally {
        loading.value = false;
    }
};

const openMappingDialog = (item: DiscoveredItem) => {
    form.value = {
        transactionType: item.transactionType,
        detailKey: item.detailKey,
        position: 'DEBIT', 
        accountUuid: ''
    };
    mappingMode.value = 'EXACT'; // Default ke exact match
    isDialogVisible.value = true;
};

const saveConfig = async () => {
    if (!form.value.accountUuid) return;
    
    // Logic Wildcard
    let finalKey = form.value.detailKey;
    if (mappingMode.value === 'PATTERN') {
        // Pastikan diakhiri underscore jika user lupa
        if (!finalKey.endsWith('_')) finalKey += '_';
    }

    const payload = { ...form.value, detailKey: finalKey };
    
    try {
        await createConfig(payload);
        isDialogVisible.value = false;
        await loadData();
    } catch (e) {
        console.error("Error save", e);
    }
};

const deleteConfig = async (uuid: string) => {
    // Gunakan dialog konfirmasi yang lebih soft di real app, disini pakai native confirm
    if (!confirm('Putuskan hubungan akun ini? Transaksi dengan kode ini akan kembali berstatus "Belum Terpetakan".')) return;
    try {
        await removeConfig(uuid);
        await loadData();
    } catch (e) { console.error(e); }
};

// Computed
const mappedCount = computed(() => discoveryItems.value.filter(i => i.isMapped).length);
const unmappedCount = computed(() => discoveryItems.value.length - mappedCount.value);
const mappedPercentage = computed(() => {
    if (!discoveryItems.value.length) return 0;
    return Math.round((mappedCount.value / discoveryItems.value.length) * 100);
});

onMounted(loadData);
</script>

<template>
    <div class="flex flex-col gap-4 p-2">
        
        <div class="flex flex-col md:flex-row gap-6">
            <div class="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div class="relative z-10">
                    <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2 mb-2">
                        <span class="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                            <i class="pi pi-sparkles text-lg"></i>
                        </span>
                        Deteksi Transaksi Otomatis
                    </h1>
                    <p class="text-slate-500 text-sm leading-relaxed max-w-2xl">
                        Sistem mendeteksi kode transaksi dari database yang belum memiliki pasangan di Akuntansi. 
                        Hubungkan kode-kode ini ke <strong>Akun Perkiraan (COA)</strong> agar jurnal keuangan terbentuk otomatis.
                    </p>
                </div>
                <div class="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-indigo-50 to-transparent opacity-50 pointer-events-none"></div>
            </div>

            <div class="w-full md:w-80 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Kesehatan Mapping</span>
                    <span class="text-2xl font-bold" :class="mappedPercentage === 100 ? 'text-emerald-600' : 'text-indigo-600'">
                        {{ mappedPercentage }}%
                    </span>
                </div>
                <div class="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div class="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-1000 ease-out" :style="{ width: `${mappedPercentage}%` }"></div>
                </div>
                <div class="flex justify-between text-xs">
                    <span class="text-slate-500">
                        <strong class="text-emerald-600">{{ mappedCount }}</strong> Terhubung
                    </span>
                    <span class="text-slate-500">
                        <strong class="text-amber-500">{{ unmappedCount }}</strong> Perlu Tindakan
                    </span>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
            
            <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white sticky top-0 z-20">
                <div class="relative w-full sm:w-72">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input 
                        v-model="filters['global'].value" 
                        type="text" 
                        placeholder="Cari Kode, Tipe, atau Status..." 
                        class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    >
                </div>
                <button 
                    @click="loadData" 
                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                    <i class="pi pi-refresh" :class="{'animate-spin': loading}"></i>
                    <span>Scan Ulang</span>
                </button>
            </div>

            <DataTable 
                :value="discoveryItems" 
                :filters="filters" 
                :loading="loading" 
                paginator :rows="10"
                class="w-full"
                :rowClass="() => 'hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0'"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <i class="pi pi-inbox text-3xl opacity-50"></i>
                        </div>
                        <p class="font-medium text-slate-600">Tidak ada data ditemukan</p>
                        <p class="text-sm">Semua transaksi sepertinya sudah aman.</p>
                    </div>
                </template>

                <Column field="transactionType" header="Tipe" sortable class="w-[15%]">
                    <template #body="{ data }">
                        <span class="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
                            {{ data.transactionType }}
                        </span>
                    </template>
                </Column>

                <Column field="detailKey" header="Kode Referensi Sistem" sortable class="w-[35%]">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-2">
                                <code class="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 select-all" title="Klik untuk copy">
                                    {{ data.detailKey }}
                                </code>
                                <span v-if="data.frequency > 50" class="flex h-2 w-2 relative" title="Sering muncul">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                            </div>
                            <span v-if="data.detailKey.includes('_')" class="text-[10px] text-slate-400 flex items-center gap-1">
                                <i class="pi pi-info-circle text-[9px]"></i> Terdeteksi pola berulang
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Akun Terhubung" field="isMapped" sortable class="w-[35%]">
                    <template #body="{ data }">
                        <div v-if="data.isMapped" class="flex items-center justify-between p-2 pr-3 rounded-lg border border-transparent hover:border-slate-200 group transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <i class="pi pi-link text-sm"></i>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                        {{ data.mappedAccount }}
                                    </span>
                                    <span class="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                        <i class="pi pi-check-circle text-[9px]"></i> Aktif
                                    </span>
                                </div>
                            </div>
                            <span 
                                class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                :class="data.mappedPosition === 'DEBIT' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'"
                            >
                                {{ data.mappedPosition }}
                            </span>
                        </div>

                        <div v-else class="flex items-center gap-2 py-2">
                            <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                                <i class="pi pi-unlink text-sm"></i>
                            </div>
                            <span class="text-sm text-slate-400 italic">Belum dikonfigurasi</span>
                        </div>
                    </template>
                </Column>

                <Column header="" class="w-[15%] text-right">
                    <template #body="{ data }">
                        <button 
                            v-if="!data.isMapped"
                            @click="openMappingDialog(data)"
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all active:scale-95"
                        >
                            <i class="pi pi-plug text-[10px]"></i>
                            Hubungkan
                        </button>
                        
                        <button 
                            v-else
                            @click="deleteConfig(data.configUuid)"
                            class="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Koneksi"
                        >
                            <i class="pi pi-trash"></i>
                        </button>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog 
            v-model:visible="isDialogVisible" 
            header="Hubungkan ke Akuntansi" 
            modal 
            :breakpoints="{ '960px': '75vw', '640px': '90vw' }" 
            :style="{ width: '500px' }"
            class="font-sans"
            :draggable="false"
        >
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 flex flex-col gap-1">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sumber Transaksi</span>
                <div class="flex items-center gap-2">
                    <code class="text-sm font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                        {{ form.detailKey }}
                    </code>
                    <span class="text-xs text-slate-500">({{ form.transactionType }})</span>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Metode Pencocokan</label>
                    <div class="grid grid-cols-2 gap-3">
                        <div 
                            @click="mappingMode = 'EXACT'"
                            class="cursor-pointer border-2 rounded-xl p-3 flex flex-col gap-2 transition-all relative overflow-hidden"
                            :class="mappingMode === 'EXACT' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'"
                        >
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold uppercase tracking-wide" :class="mappingMode === 'EXACT' ? 'text-indigo-700' : 'text-slate-500'">Persis (Exact)</span>
                                <i v-if="mappingMode === 'EXACT'" class="pi pi-check-circle text-indigo-600"></i>
                            </div>
                            <p class="text-[10px] text-slate-500 leading-snug">
                                Hanya berlaku untuk kode <strong>{{ form.detailKey }}</strong> saja.
                            </p>
                        </div>

                        <div 
                            @click="mappingMode = 'PATTERN'"
                            class="cursor-pointer border-2 rounded-xl p-3 flex flex-col gap-2 transition-all relative overflow-hidden"
                            :class="mappingMode === 'PATTERN' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'"
                        >
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold uppercase tracking-wide" :class="mappingMode === 'PATTERN' ? 'text-indigo-700' : 'text-slate-500'">Pola (Wildcard)</span>
                                <i v-if="mappingMode === 'PATTERN'" class="pi pi-check-circle text-indigo-600"></i>
                            </div>
                            <p class="text-[10px] text-slate-500 leading-snug">
                                Berlaku untuk semua kode yang berawalan sama.
                            </p>
                        </div>
                    </div>

                    <div v-if="mappingMode === 'PATTERN'" class="mt-3 pl-1 animate-fade-in-down">
                        <label class="text-xs font-bold text-slate-600 mb-1 block">Edit Pola Prefix</label>
                        <div class="flex items-center">
                            <input 
                                v-model="form.detailKey" 
                                type="text" 
                                class="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-lg border border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500" 
                                placeholder="Misal: SALE_INV_"
                            >
                            <span class="inline-flex items-center px-3 py-2 rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 text-slate-500 text-sm font-mono font-bold">
                                _ (Apapun)
                            </span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-1">Sistem akan menangkap semua kode yang diawali teks tersebut.</p>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">
                        Masuk ke Akun Apa? <span class="text-red-500">*</span>
                    </label>
                    <Dropdown 
                        v-model="form.accountUuid" 
                        :options="accounts" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        filter 
                        placeholder="Pilih Akun Perkiraan..." 
                        class="w-full md:w-full"
                        :virtualScrollerOptions="{ itemSize: 38 }"
                    >
                        <template #option="slotProps">
                            <div class="flex items-center justify-between w-full">
                                <span class="text-sm text-slate-700">{{ slotProps.option.name }}</span>
                                <span class="text-xs font-mono bg-slate-100 text-slate-500 px-1.5 rounded">{{ slotProps.option.code }}</span>
                            </div>
                        </template>
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center gap-2">
                                <span class="bg-slate-800 text-white text-[10px] font-mono px-1.5 rounded">{{ accounts.find(a => a.uuid === slotProps.value)?.code }}</span>
                                <span class="text-sm font-semibold">{{ accounts.find(a => a.uuid === slotProps.value)?.name }}</span>
                            </div>
                            <span v-else class="text-slate-400 text-sm">{{ slotProps.placeholder }}</span>
                        </template>
                    </Dropdown>
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-2">Posisi Nilai</label>
                    <div class="flex gap-4">
                        <label class="flex-1 cursor-pointer">
                            <input type="radio" v-model="form.position" value="DEBIT" class="peer sr-only">
                            <div class="rounded-lg border border-slate-200 p-3 text-center transition-all peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-slate-50">
                                <div class="font-bold text-sm">DEBIT</div>
                                <div class="text-[10px] opacity-70">Menambah Aset / Beban</div>
                            </div>
                        </label>
                        <label class="flex-1 cursor-pointer">
                            <input type="radio" v-model="form.position" value="CREDIT" class="peer sr-only">
                            <div class="rounded-lg border border-slate-200 p-3 text-center transition-all peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 hover:bg-slate-50">
                                <div class="font-bold text-sm">KREDIT</div>
                                <div class="text-[10px] opacity-70">Menambah Hutang / Modal</div>
                            </div>
                        </label>
                    </div>
                </div>

            </div>

            <template #footer>
                <div class="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
                    <button 
                        @click="isDialogVisible = false"
                        class="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        @click="saveConfig" 
                        :disabled="!form.accountUuid"
                        class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                    >
                        Simpan Koneksi
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* Animasi kecil */
@keyframes fadeInDown {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
    animation: fadeInDown 0.2s ease-out forwards;
}
</style>