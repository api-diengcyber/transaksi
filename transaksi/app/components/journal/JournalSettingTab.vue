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

// --- Services (Mocked for context preservation) ---
// Asumsi: composables ini sudah ada di project Anda
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
const isWildcardMode = ref(false);

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
    isWildcardMode.value = false;
    isDialogVisible.value = true;
};

const saveConfig = async () => {
    if (!form.value.accountUuid) return;
    
    // Logic Wildcard (simplifikasi sesuai kode asli)
    let payload = { ...form.value };
    
    try {
        await createConfig(payload);
        isDialogVisible.value = false;
        await loadData();
    } catch (e) {
        console.error("Error save", e);
    }
};

const deleteConfig = async (uuid: string) => {
    if (!confirm('Hapus mapping akun ini? Status akan kembali menjadi Unmapped.')) return;
    try {
        await removeConfig(uuid);
        await loadData();
    } catch (e) { console.error(e); }
};

// Helper: Menghitung persentase mapped
const mappedPercentage = computed(() => {
    if (!discoveryItems.value.length) return 0;
    const mapped = discoveryItems.value.filter(i => i.isMapped).length;
    return Math.round((mapped / discoveryItems.value.length) * 100);
});

onMounted(loadData);
</script>

<template>
    <div class="flex flex-col gap-6 p-4 md:p-6 bg-surface-50 dark:bg-surface-900 min-h-screen">
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="md:col-span-2 bg-white dark:bg-surface-800 p-5 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10">
                    <i class="pi pi-compass text-6xl text-primary-500"></i>
                </div>
                <h2 class="text-xl font-bold text-surface-800 dark:text-surface-100 mb-2 flex items-center gap-2">
                    <i class="pi pi-compass text-primary-500"></i> Auto-Discovery Mode
                </h2>
                <p class="text-surface-600 dark:text-surface-400 leading-relaxed text-sm max-w-2xl">
                    Sistem memindai seluruh transaksi database dan mengelompokkan key jurnal unik.
                    Hubungkan key tersebut ke Akun Akuntansi (COA) agar laporan keuangan terbentuk otomatis.
                </p>
            </div>

            <div class="bg-white dark:bg-surface-800 p-5 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 flex flex-col justify-center">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-surface-500 dark:text-surface-400 font-medium text-sm">Kelengkapan Mapping</span>
                    <span class="text-2xl font-bold text-primary-600 dark:text-primary-400">{{ mappedPercentage }}%</span>
                </div>
                <ProgressBar :value="mappedPercentage" :showValue="false" class="h-3 rounded-full bg-surface-100 dark:bg-surface-700" />
                <div class="mt-3 text-xs text-surface-500 text-right">
                    {{ discoveryItems.filter(i => i.isMapped).length }} dari {{ discoveryItems.length }} item terhubung
                </div>
            </div>
        </div>

        <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 flex flex-col">
            <div class="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <IconField iconPosition="left" class="w-full sm:w-72">
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="filters['global'].value" placeholder="Cari Key atau Tipe..." class="w-full p-inputtext-sm" />
                </IconField>
                
                <div class="flex gap-2">
                    <Button 
                        label="Scan Ulang" 
                        icon="pi pi-refresh" 
                        severity="secondary" 
                        outlined 
                        size="small"
                        @click="loadData" 
                        :loading="loading"
                    />
                </div>
            </div>

            <DataTable 
                :value="discoveryItems" 
                :filters="filters" 
                :loading="loading" 
                paginator :rows="10"
                :rowsPerPageOptions="[10, 20, 50]"
                responsiveLayout="scroll"
                class="p-datatable-sm"
                tableStyle="min-width: 50rem"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-500">
                        <i class="pi pi-folder-open text-4xl mb-2 opacity-50"></i>
                        <p>Tidak ada data jurnal ditemukan.</p>
                    </div>
                </template>
                
                <Column field="transactionType" header="Tipe Transaksi" sortable style="width: 20%">
                    <template #body="{ data }">
                        <Tag :value="data.transactionType" severity="info" class="font-mono text-xs uppercase tracking-wide" />
                    </template>
                </Column>
                
                <Column field="detailKey" header="Key Database" sortable style="width: 35%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <code class="text-sm font-bold font-mono text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-700 px-2 py-1 rounded">
                                    {{ data.detailKey }}
                                </code>
                            </div>
                            <Tag v-tooltip.top="'Frekuensi Kemunculan'" :value="data.frequency + 'x'" severity="secondary" class="text-xs" rounded />
                        </div>
                    </template>
                </Column>

                <Column header="Status Mapping" sortable field="isMapped" style="width: 30%">
                    <template #body="{ data }">
                        <div v-if="data.isMapped" class="flex flex-col gap-1">
                            <div class="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
                                <i class="pi pi-check-circle"></i>
                                <span>Terhubung</span>
                            </div>
                            <div class="text-xs text-surface-600 dark:text-surface-400 pl-6">
                                {{ data.mappedAccount }} 
                                <span class="font-bold ml-1" :class="data.mappedPosition === 'DEBIT' ? 'text-blue-500' : 'text-red-500'">
                                    {{ data.mappedPosition }}
                                </span>
                            </div>
                        </div>
                        <div v-else>
                            <span class="text-surface-400 dark:text-surface-500 text-sm italic flex items-center gap-1">
                                <i class="pi pi-exclamation-circle"></i> Belum dikonfigurasi
                            </span>
                        </div>
                    </template>
                </Column>

                <Column header="Aksi" style="width: 15%; text-align: center">
                    <template #body="{ data }">
                        <div v-if="data.isMapped">
                             <Button 
                                icon="pi pi-pencil" 
                                text 
                                rounded
                                severity="secondary"
                                @click="deleteConfig(data.configUuid)" 
                                v-tooltip.left="'Edit / Hapus Mapping'"
                            />
                        </div>
                        <div v-else>
                            <Button 
                                label="Link" 
                                icon="pi pi-link" 
                                size="small" 
                                outlined
                                @click="openMappingDialog(data)" 
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog 
            v-model:visible="isDialogVisible" 
            header="Konfigurasi Mapping Jurnal" 
            modal 
            :breakpoints="{ '960px': '75vw', '640px': '90vw' }" 
            :style="{ width: '500px' }"
            class="p-fluid"
        >
            <div class="bg-surface-50 dark:bg-surface-800 p-4 rounded-lg border border-surface-200 dark:border-surface-700 mb-6 flex flex-col gap-3">
                <div class="flex justify-between items-center border-b border-surface-200 dark:border-surface-600 pb-2">
                    <span class="text-xs text-surface-500 uppercase tracking-wider font-bold">Tipe Transaksi</span>
                    <span class="text-sm font-semibold text-primary-600">{{ form.transactionType }}</span>
                </div>
                <div>
                    <span class="text-xs text-surface-500 uppercase tracking-wider font-bold block mb-1">Key Asli (Database)</span>
                    <code class="text-sm font-mono bg-white dark:bg-surface-900 px-2 py-1.5 rounded border border-surface-300 dark:border-surface-600 block w-full truncate">
                        {{ form.detailKey }}
                    </code>
                </div>
            </div>

            <div class="flex flex-col gap-5">
                <div class="field">
                    <div class="flex items-start gap-3 p-3 border border-surface-200 dark:border-surface-700 rounded-lg transition-colors" :class="{'bg-primary-50 dark:bg-primary-900/20 border-primary-200': isWildcardMode}">
                        <Checkbox v-model="isWildcardMode" :binary="true" inputId="wc-mode" class="mt-1" />
                        <div class="flex-1">
                            <label for="wc-mode" class="font-semibold text-sm cursor-pointer block mb-1">Gunakan Pola Wildcard</label>
                            <p class="text-xs text-surface-500 leading-snug">
                                Abaikan ID unik di belakang key. Contoh: <code>stok_PROD_01</code> menjadi pola <code>stok_PROD_</code>.
                            </p>
                        </div>
                    </div>
                    
                    <div v-if="isWildcardMode" class="mt-3 pl-8">
                        <label class="text-xs font-bold mb-1 block text-surface-600">Edit Key Pola (Akhiri dengan _)</label>
                        <InputText v-model="form.detailKey" placeholder="Contoh: stok_min_" />
                    </div>
                </div>

                <div class="field">
                    <label class="text-sm font-bold block mb-1">Pilih Akun (Chart of Account)</label>
                    <Dropdown 
                        v-model="form.accountUuid" 
                        :options="accounts" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        filter 
                        placeholder="Cari Akun..." 
                        class="w-full"
                    >
                        <template #option="slotProps">
                            <div class="flex flex-col py-1">
                                <span class="font-semibold text-sm">{{ slotProps.option.name }}</span>
                                <span class="text-xs text-surface-500 font-mono">{{ slotProps.option.code }}</span>
                            </div>
                        </template>
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center">
                                <span class="mr-2 font-mono text-surface-500 text-xs">{{ accounts.find(a => a.uuid === slotProps.value)?.code }}</span>
                                <span>{{ accounts.find(a => a.uuid === slotProps.value)?.name }}</span>
                            </div>
                            <span v-else>{{ slotProps.placeholder }}</span>
                        </template>
                    </Dropdown>
                </div>

                <div class="field">
                    <label class="text-sm font-bold block mb-1">Posisi Default</label>
                    <SelectButton v-model="form.position" :options="['DEBIT', 'CREDIT']" aria-labelledby="basic" class="w-full" />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 pt-2">
                    <Button label="Batal" text severity="secondary" @click="isDialogVisible = false" />
                    <Button label="Simpan Mapping" icon="pi pi-check" @click="saveConfig" :disabled="!form.accountUuid" />
                </div>
            </template>
        </Dialog>
    </div>
</template>