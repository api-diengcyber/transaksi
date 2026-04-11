<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({ modelValue: String, warehouses: Array, users: Array });
const emit = defineEmits(['update:modelValue']);

const warehouseService = useWarehouseService();
const journalService = useJournalService();
const toast = useToast();

const opnameView = ref('input'); 
const opnameData = ref([]);
const unverifiedOpnames = ref([]);
const searchQueryOpname = ref('');
const selectedOpnameUserUuid = ref(null); 
const dataLoading = ref(false);
const opnameLoading = ref(false);
const verifyLoading = ref(false);

const filteredOpnameData = computed(() => {
    if (!searchQueryOpname.value) return opnameData.value;
    const query = searchQueryOpname.value.toLowerCase();
    return opnameData.value.filter(item => item.name.toLowerCase().includes(query) || (item.barcode && item.barcode.toLowerCase().includes(query)));
});

const loadOpnameData = async (uuid) => {
    if (!uuid) {
        opnameData.value = [];
        unverifiedOpnames.value = [];
        selectedOpnameUserUuid.value = null;
        return;
    }
    dataLoading.value = true;
    try {
        const [stockRes, unverifiedRes] = await Promise.all([
            warehouseService.getWarehouseStock(uuid),
            journalService.getUnverifiedOpnames(uuid)
        ]);
        
        const products = stockRes?.data?.products || stockRes?.products || [];
        opnameData.value = products.map(p => ({
            uuid: p.uuid, name: p.name, barcode: p.barcode,
            systemStock: p.stock || 0, actualStock: p.stock || 0, note: 'Penyesuaian Opname Fisik'
        }));
        unverifiedOpnames.value = unverifiedRes?.data || unverifiedRes || [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data opname', life: 3000 });
    } finally {
        dataLoading.value = false;
    }
};

watch(() => props.modelValue, (newUuid) => loadOpnameData(newUuid), { immediate: true });

const submitOpnameDraft = async () => {
    if (!props.modelValue || !selectedOpnameUserUuid.value) {
        toast.add({ severity: 'warn', summary: 'Aksi Ditolak', detail: 'Pilih Gudang dan PIC terlebih dahulu!', life: 3000 });
        return;
    }
    const adjustedItems = opnameData.value.filter(item => item.actualStock !== item.systemStock);
    if (adjustedItems.length === 0) {
        toast.add({ severity: 'info', summary: 'Selesai', detail: 'Tidak ada selisih stok untuk diproses.', life: 3000 });
        return;
    }
    opnameLoading.value = true;
    try {
        const payload = {
            warehouse_uuid: props.modelValue,
            user_uuid: selectedOpnameUserUuid.value,
            items: adjustedItems.map(item => ({
                product_uuid: item.uuid, system_stock: item.systemStock, actual_stock: item.actualStock,
                difference: item.actualStock - item.systemStock,
                note: item.note || `Opname Fisik. Selisih: ${item.actualStock - item.systemStock}`
            }))
        };
        await journalService.createOpnameDraft(payload); 
        toast.add({ severity: 'success', summary: 'Draft Disimpan', detail: `Opname dikirim untuk verifikasi.`, life: 4000 });
        await loadOpnameData(props.modelValue);
        opnameView.value = 'verify'; 
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal mengirim draft opname.', life: 4000 });
    } finally {
        opnameLoading.value = false;
    }
};

const verifyOpname = async (journalUuid) => {
    verifyLoading.value = true;
    try {
        await journalService.verifyOpnameJournal(journalUuid); 
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Opname telah diverifikasi dan stok diupdate.', life: 3000 });
        await loadOpnameData(props.modelValue);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat memverifikasi.', life: 3000 });
    } finally {
        verifyLoading.value = false;
    }
};
</script>

<template>
    <div class="p-4 md:p-6 flex flex-col gap-5">
        <div class="flex flex-col sm:flex-row gap-3 border-b border-surface-200 pb-4">
            <Button label="Input Opname Fisik" icon="pi pi-pencil" :severity="opnameView === 'input' ? 'primary' : 'secondary'" :outlined="opnameView !== 'input'" @click="opnameView = 'input'" />
            <Button label="Menunggu Verifikasi" icon="pi pi-shield" :severity="opnameView === 'verify' ? 'warning' : 'secondary'" :outlined="opnameView !== 'verify'" :badge="unverifiedOpnames.length > 0 ? unverifiedOpnames.length.toString() : null" badgeClass="p-badge-danger" @click="opnameView = 'verify'" />
        </div>

        <div v-if="opnameView === 'input'" class="animate-fade-in flex flex-col gap-5">
            <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-blue-50 p-5 rounded-xl border border-blue-200">
                <div class="w-full xl:w-1/3">
                    <h3 class="font-bold text-lg text-blue-800">Draft Opname Fisik</h3>
                    <p class="text-sm text-blue-600 mt-1">Stok tidak akan berubah sebelum diverifikasi oleh Supervisor.</p>
                </div>
                <div class="flex flex-col md:flex-row gap-3 w-full xl:w-2/3 items-center xl:justify-end">
                    <Dropdown :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" :options="warehouses" optionLabel="name" optionValue="uuid" filter placeholder="1. Pilih Gudang..." class="w-full md:w-48" showClear />
                    <Dropdown v-model="selectedOpnameUserUuid" :options="users" optionLabel="name" optionValue="uuid" filter placeholder="2. Pilih PIC..." class="w-full md:w-56">
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex items-center gap-2"><i class="pi pi-user text-blue-600"></i><span class="font-semibold">{{ users.find(u => u.uuid === slotProps.value)?.name }}</span></div>
                            <span v-else>{{ slotProps.placeholder }}</span>
                        </template>
                    </Dropdown>
                    <IconField iconPosition="left" class="w-full md:w-48"><InputIcon class="pi pi-search" /><InputText v-model="searchQueryOpname" placeholder="Cari Barang..." class="w-full bg-white" /></IconField>
                    <Button label="Kirim Draft" icon="pi pi-send" severity="primary" class="w-full md:w-auto" :disabled="!modelValue" :loading="opnameLoading" @click="submitOpnameDraft" />
                </div>
            </div>

            <div class="border border-surface-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <DataTable :value="filteredOpnameData" :loading="dataLoading" stripedRows class="p-datatable-sm">
                    <template #empty>
                        <div class="p-8 text-center text-surface-500">
                            <i class="pi pi-box text-4xl mb-3 opacity-50 block"></i>
                            <span v-if="!modelValue">Pilih gudang di atas untuk memulai opname.</span><span v-else>Gudang ini masih kosong.</span>
                        </div>
                    </template>
                    <Column header="Informasi Produk" style="min-width: 15rem">
                        <template #body="{ data }"><div class="font-bold text-surface-900">{{ data.name }}</div></template>
                    </Column>
                    <Column header="Stok Sistem" class="text-center">
                        <template #body="{ data }"><span class="font-black text-lg text-surface-600 bg-surface-100 px-4 py-1.5 rounded-lg border">{{ data.systemStock }}</span></template>
                    </Column>
                    <Column header="Stok Aktual (Fisik)" class="text-center" style="width: 14rem">
                        <template #body="{ data }"><InputNumber v-model="data.actualStock" showButtons buttonLayout="horizontal" :min="0" class="w-full" decrementButtonIcon="pi pi-minus" incrementButtonIcon="pi pi-plus" /></template>
                    </Column>
                    <Column header="Selisih" class="text-center">
                        <template #body="{ data }">
                            <div v-if="data.actualStock !== data.systemStock">
                                <span class="font-bold text-sm px-3 py-1 rounded-full" :class="(data.actualStock - data.systemStock) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">
                                    {{ (data.actualStock - data.systemStock) > 0 ? '+' : '' }}{{ data.actualStock - data.systemStock }}
                                </span>
                            </div>
                            <div v-else><span class="text-surface-400 text-xs italic">Sesuai</span></div>
                        </template>
                    </Column>
                    <Column header="Catatan Penyesuaian" style="min-width: 12rem">
                        <template #body="{ data }"><InputText v-model="data.note" placeholder="Alasan selisih..." class="w-full text-sm" :disabled="data.actualStock === data.systemStock" /></template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <div v-else-if="opnameView === 'verify'" class="animate-fade-in flex flex-col gap-5">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-50 p-5 rounded-xl border border-surface-200">
                <div class="flex flex-col w-full md:w-1/3">
                    <label class="text-xs font-bold text-surface-500 mb-2 uppercase">Filter Lokasi Gudang</label>
                    <Dropdown :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" :options="warehouses" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Gudang..." class="w-full" showClear />
                </div>
                <Button label="Refresh Antrean" icon="pi pi-sync" outlined severity="secondary" :disabled="!modelValue" @click="loadOpnameData(modelValue)" />
            </div>

            <div class="border border-warning-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <DataTable :value="unverifiedOpnames" :loading="dataLoading" class="p-datatable-sm">
                    <template #empty>
                        <div class="p-16 text-center text-surface-500">
                            <i class="pi pi-check-circle text-4xl mb-4 text-emerald-500 block"></i>
                            <p class="text-lg font-semibold text-surface-700">Semua Bersih!</p>
                        </div>
                    </template>
                    <Column header="Kode Dokumen">
                        <template #body="{ data }"><span class="font-mono font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded">{{ data.code }}</span></template>
                    </Column>
                    <Column header="PIC (Pembuat)">
                        <template #body="{ data }"><span class="font-semibold">{{ users.find(u => u.uuid === data.createdBy)?.name || 'Unknown' }}</span></template>
                    </Column>
                    <Column header="Aksi" alignFrozen="right" class="text-right">
                        <template #body="{ data }">
                            <Button label="Verifikasi & Sesuaikan" icon="pi pi-check" severity="success" size="small" :loading="verifyLoading" @click="verifyOpname(data.uuid)" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>