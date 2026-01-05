<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

// --- Interfaces ---
interface Account { 
    uuid: string; 
    code: string; 
    name: string; 
}

interface ConfigItem {
    uuid?: string;
    accountName?: string;
    accountCode?: string;
    accountUuid: string;
    position: 'DEBIT' | 'CREDIT';
}

interface DiscoveredItem {
    transactionType: string;
    detailKey: string;
    frequency: number;
    totalValue: number; // Field baru untuk menampung SUM value
    isMapped: boolean;
    isWildcard: boolean;
    configs: ConfigItem[];
}

interface JournalConfigPayload {
    transactionType: string;
    detailKey: string;
    items: {
        accountUuid: string;
        position: 'DEBIT' | 'CREDIT';
    }[];
}

// --- Services ---
const { getDiscovery, create: createConfig } = useJournalConfigService();
const { getAll: fetchAccounts } = useAccountService();

// --- State ---
const discoveryItems = ref<DiscoveredItem[]>([]);
const accounts = ref<Account[]>([]);
const loading = ref(false);
const isDialogVisible = ref(false);

// Form State
const currentKey = ref('');
const currentType = ref('');
const mappingMode = ref<'EXACT' | 'PATTERN'>('EXACT');
const formItems = ref<{ accountUuid: string; position: 'DEBIT' | 'CREDIT' }[]>([]);

// Filter Table
const filters = ref({
    global: { value: null, matchMode: 'contains' },
});

// --- Actions ---
const loadData = async () => {
    loading.value = true;
    try {
        const [discRes, accRes] = await Promise.all([ 
            getDiscovery({ prefix: '' }), 
            fetchAccounts() 
        ]) as any[];

        discoveryItems.value = (discRes.data || discRes || []) as DiscoveredItem[];
        accounts.value = (accRes.data || accRes || []) as Account[];
    } catch (e) {
        console.error("Gagal memuat data discovery", e);
    } finally {
        loading.value = false;
    }
};

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value);
};

const openMappingDialog = (item: DiscoveredItem) => {
    currentKey.value = item.detailKey;
    currentType.value = item.transactionType;
    
    // Jika sudah ada config, load ke form
    if (item.configs && item.configs.length > 0) {
        formItems.value = item.configs.map(c => ({
            accountUuid: c.accountUuid,
            position: c.position
        }));
        
        // Deteksi mode berdasarkan apakah detailKey source berbeda dengan detailKey item (indikasi wildcard)
        // Atau gunakan flag isWildcard jika backend mengirimnya
        mappingMode.value = item.isWildcard ? 'PATTERN' : 'EXACT';
        
        // Jika wildcard, kita tampilkan source key-nya (misal: "sale_") bukan item key-nya ("sale_123")
        if (item.isWildcard && item.configs[0]) {
             // Asumsi backend mengirim source key di salah satu property config, atau kita edit manual
             // Di sini kita biarkan user mengedit jika perlu
             // currentKey.value = (item.configs[0] as any).detailKeySource || item.detailKey;
        }
    } else {
        // Default baru
        formItems.value = [{ accountUuid: '', position: 'DEBIT' }];
        mappingMode.value = 'EXACT';
    }
    
    isDialogVisible.value = true;
};

const addFormItem = () => {
    formItems.value.push({ accountUuid: '', position: 'CREDIT' });
};

const removeFormItem = (index: number) => {
    formItems.value.splice(index, 1);
};

const saveConfig = async () => {
    // Validasi sederhana
    const validItems = formItems.value.filter(i => i.accountUuid);
    if (validItems.length === 0) return;
    
    // Logic Wildcard
    let finalKey = currentKey.value;
    if (mappingMode.value === 'PATTERN') {
        // Pastikan diakhiri underscore jika user lupa (opsional, tergantung preferensi)
        if (!finalKey.endsWith('_')) finalKey += '_';
    }

    const payload: JournalConfigPayload = {
        transactionType: currentType.value,
        detailKey: finalKey,
        items: validItems
    };
    
    try {
        await createConfig(payload);
        isDialogVisible.value = false;
        await loadData();
    } catch (e) {
        console.error("Error save", e);
    }
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
                        Konfigurasi Jurnal Otomatis
                    </h1>
                    <p class="text-slate-500 text-sm leading-relaxed max-w-2xl">
                        Hubungkan kode transaksi sistem ke <strong>Multi-Akun (Split Journal)</strong>. 
                        Satu transaksi dapat memecah nilai ke Debit/Kredit berbeda.
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
                    <span class="text-slate-500"><strong class="text-emerald-600">{{ mappedCount }}</strong> Terhubung</span>
                    <span class="text-slate-500"><strong class="text-amber-500">{{ unmappedCount }}</strong> Pending</span>
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
                        placeholder="Cari Kode..." 
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
                        <i class="pi pi-inbox text-3xl opacity-50 mb-2"></i>
                        <p class="font-medium">Tidak ada data transaksi ditemukan</p>
                    </div>
                </template>

                <Column field="transactionType" header="Tipe" sortable class="w-[10%]">
                    <template #body="{ data }">
                        <span class="inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200">
                            {{ data.transactionType }}
                        </span>
                    </template>
                </Column>

                <Column field="detailKey" header="Kode Transaksi" sortable class="w-[25%]">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1">
                            <code class="font-mono text-xs font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded w-fit select-all border border-slate-100">
                                {{ data.detailKey }}
                            </code>
                            <span v-if="data.isWildcard" class="text-[10px] text-amber-600 flex items-center gap-1 font-medium">
                                <i class="pi pi-bolt text-[9px]"></i> Pola Wildcard
                            </span>
                        </div>
                    </template>
                </Column>
                
                <Column field="totalValue" header="Total Nilai" sortable class="w-[15%]">
                    <template #body="{ data }">
                        <div class="flex flex-col items-end text-right">
                            <span class="text-xs font-bold text-slate-700 font-mono">
                                {{ formatNumber(data.totalValue) }}
                            </span>
                            <span class="text-[9px] text-slate-400">
                                dr {{ data.frequency }} transaksi
                            </span>
                        </div>
                    </template>
                </Column>
                
                <Column header="Konfigurasi Akun (Jurnal)" class="w-[40%]">
                    <template #body="{ data }">
                        <div v-if="data.isMapped && data.configs.length" class="flex flex-col gap-1.5 py-1">
                            <div v-for="cfg in data.configs" :key="cfg.uuid" 
                                class="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded px-2 py-1 group hover:border-indigo-100 transition-colors"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="font-mono text-slate-400 text-[10px] bg-white px-1 rounded border border-slate-100">{{ cfg.accountCode }}</span>
                                    <span class="font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{{ cfg.accountName }}</span>
                                </div>
                                <span 
                                    class="text-[9px] font-bold px-1.5 py-0.5 rounded border"
                                    :class="cfg.position === 'DEBIT' ? 'text-blue-700 bg-blue-50 border-blue-100' : 'text-red-700 bg-red-50 border-red-100'"
                                >
                                    {{ cfg.position }}
                                </span>
                            </div>
                        </div>
                        <div v-else class="flex items-center gap-2 py-2 opacity-60">
                            <i class="pi pi-exclamation-circle text-slate-400"></i>
                            <span class="text-xs text-slate-500 italic">Belum dikonfigurasi</span>
                        </div>
                    </template>
                </Column>

                <Column class="w-[10%] text-right">
                    <template #body="{ data }">
                        <button 
                            @click="openMappingDialog(data)"
                            class="inline-flex items-center justify-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all border"
                            :class="data.isMapped 
                                ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600' 
                                : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:border-indigo-700 shadow-sm hover:shadow'"
                        >
                            <i class="pi" :class="data.isMapped ? 'pi-pencil' : 'pi-link'"></i>
                            {{ data.isMapped ? 'Edit' : 'Atur' }}
                        </button>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog 
            v-model:visible="isDialogVisible" 
            header="Setting Jurnal Transaksi" 
            modal 
            :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
            :style="{ width: '600px' }"
            :draggable="false"
            class="font-sans"
        >
            <div class="flex flex-col gap-5">
                
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                    <div>
                        <div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Tipe Transaksi</div>
                        <div class="font-bold text-slate-800 text-sm">{{ currentType }}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Kode Referensi</div>
                        <code class="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-sm">{{ currentKey }}</code>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Metode Pencocokan</label>
                    <div class="grid grid-cols-2 gap-4">
                        <label 
                            class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                            :class="mappingMode === 'EXACT' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200'"
                        >
                            <input type="radio" v-model="mappingMode" value="EXACT" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                            <div>
                                <span class="block text-sm font-bold text-slate-700">Persis (Exact)</span>
                                <span class="block text-[10px] text-slate-500">Hanya kode spesifik ini saja</span>
                            </div>
                        </label>
                        <label 
                            class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                            :class="mappingMode === 'PATTERN' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200'"
                        >
                            <input type="radio" v-model="mappingMode" value="PATTERN" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
                            <div>
                                <span class="block text-sm font-bold text-slate-700">Pola (Wildcard)</span>
                                <span class="block text-[10px] text-slate-500">Semua kode dengan awalan sama</span>
                            </div>
                        </label>
                    </div>
                    
                    <div v-if="mappingMode === 'PATTERN'" class="mt-3 animate-fade-in-down">
                        <div class="flex items-center gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-amber-800 text-xs">
                            <i class="pi pi-info-circle text-amber-600"></i>
                            <span class="flex-1">Edit kode agar diakhiri <strong>"_" (underscore)</strong> untuk menangkap pola.</span>
                        </div>
                        <input 
                            v-model="currentKey" 
                            type="text" 
                            class="mt-2 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                            placeholder="Contoh: SALE_"
                        >
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Jurnal Akuntansi</label>
                        <button 
                            @click="addFormItem" 
                            class="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                        >
                            <i class="pi pi-plus"></i> Tambah Akun
                        </button>
                    </div>

                    <div class="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                        <div v-for="(item, index) in formItems" :key="index" class="flex gap-2 items-start animate-fade-in-down group">
                            <div class="flex-1">
                                <Dropdown 
                                    v-model="item.accountUuid" 
                                    :options="accounts" 
                                    optionLabel="name" 
                                    optionValue="uuid" 
                                    filter 
                                    placeholder="Pilih Akun Perkiraan..." 
                                    class="w-full p-inputtext-sm"
                                    :virtualScrollerOptions="{ itemSize: 34 }"
                                >
                                    <template #option="slotProps">
                                        <div class="flex items-center justify-between w-full text-xs">
                                            <span class="text-slate-700">{{ slotProps.option.name }}</span>
                                            <span class="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded border border-slate-200">{{ slotProps.option.code }}</span>
                                        </div>
                                    </template>
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex items-center gap-2 text-xs">
                                            <span class="bg-slate-800 text-white text-[10px] font-mono px-1 rounded">{{ accounts.find(a => a.uuid === slotProps.value)?.code }}</span>
                                            <span class="font-semibold">{{ accounts.find(a => a.uuid === slotProps.value)?.name }}</span>
                                        </div>
                                        <span v-else class="text-xs text-slate-400">Pilih Akun...</span>
                                    </template>
                                </Dropdown>
                            </div>

                            <div class="flex bg-slate-100 rounded-lg p-1 shrink-0 border border-slate-200">
                                <button 
                                    @click="item.position = 'DEBIT'"
                                    class="px-3 py-1.5 text-[10px] font-bold rounded-md transition-all"
                                    :class="item.position === 'DEBIT' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'"
                                >DEBIT</button>
                                <button 
                                    @click="item.position = 'CREDIT'"
                                    class="px-3 py-1.5 text-[10px] font-bold rounded-md transition-all"
                                    :class="item.position === 'CREDIT' ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'"
                                >KREDIT</button>
                            </div>

                            <button 
                                @click="removeFormItem(index)" 
                                class="w-9 h-[38px] flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title="Hapus Baris"
                            >
                                <i class="pi pi-trash text-xs"></i>
                            </button>
                        </div>
                        
                        <div v-if="formItems.length === 0" class="flex flex-col items-center justify-center py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                            <i class="pi pi-list mb-1"></i>
                            <span>Belum ada akun dikonfigurasi.</span>
                        </div>
                    </div>
                </div>

            </div>

            <template #footer>
                <div class="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-2">
                    <button 
                        @click="isDialogVisible = false" 
                        class="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        @click="saveConfig" 
                        class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                        :disabled="formItems.filter(i => i.accountUuid).length === 0"
                    >
                        Simpan Konfigurasi
                    </button>
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.animate-fade-in-down {
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Custom Scrollbar for better UI inside modal */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
}
</style>