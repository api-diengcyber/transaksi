<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    modelValue: String, 
    warehouses: Array,
    users: Array,
    products: Array,
    shelves: Array
});
const emit = defineEmits(['update:modelValue']);

const warehouseService = useWarehouseService();
const journalService = useJournalService();
const toast = useToast();

const currentWarehouseData = ref(null);
const dataLoading = ref(false);

const showMutationModal = ref(false);
const mutationType = ref('IN'); 
const mutationLoading = ref(false);
const mutationForm = ref({ productUuid: null, warehouseUuid: null, shelveUuid: null, userUuid: null, qty: 1, note: '' });

const loadData = async (uuid) => {
    if (!uuid) { currentWarehouseData.value = null; return; }
    dataLoading.value = true;
    try {
        const res = await warehouseService.getWarehouseStock(uuid);
        currentWarehouseData.value = res?.data || res;
    } catch (err) {
        currentWarehouseData.value = null;
    } finally {
        dataLoading.value = false;
    }
};

watch(() => props.modelValue, (newUuid) => loadData(newUuid), { immediate: true });

const openMutationForm = (type) => {
    if (!props.modelValue) {
        toast.add({ severity: 'warn', summary: 'Ditolak', detail: 'Pilih Gudang terlebih dahulu!', life: 3000 });
        return;
    }
    mutationType.value = type;
    mutationForm.value = { productUuid: null, warehouseUuid: props.modelValue, shelveUuid: null, userUuid: null, qty: 1, note: '' };
    showMutationModal.value = true;
};

const submitMutation = async () => {
    if (!mutationForm.value.userUuid || !mutationForm.value.productUuid || mutationForm.value.qty <= 0) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Lengkapi PIC, Produk, dan Qty!', life: 3000 });
        return;
    }
    mutationLoading.value = true;
    try {
        const payload = {
            type: mutationType.value,
            product_uuid: mutationForm.value.productUuid,
            warehouse_uuid: mutationForm.value.warehouseUuid,
            shelve_uuid: mutationType.value === 'OUT' ? mutationForm.value.shelveUuid : null,
            user_uuid: mutationForm.value.userUuid,
            qty: mutationForm.value.qty,
            note: mutationForm.value.note
        };
        await journalService.createStockMutation(payload);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Mutasi stok tersimpan', life: 3000 });
        showMutationModal.value = false;
        loadData(props.modelValue);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memproses mutasi', life: 3000 });
    } finally {
        mutationLoading.value = false;
    }
};
</script>

<template>
    <div class="p-4 md:p-6 flex flex-col gap-5">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-50 dark:bg-surface-800 p-5 rounded-xl border border-surface-200 dark:border-surface-700">
            <div class="flex flex-col w-full lg:w-1/3">
                <label class="text-xs font-bold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wider">Lokasi Gudang</label>
                <Dropdown 
                    :modelValue="modelValue" 
                    @update:modelValue="emit('update:modelValue', $event)" 
                    :options="warehouses" 
                    optionLabel="name" 
                    optionValue="uuid" 
                    filter placeholder="Pilih Gudang..." 
                    class="w-full" showClear 
                />
            </div>
            <div class="flex gap-3 w-full lg:w-auto items-center">
                <Button label="Barang Masuk" icon="pi pi-arrow-down-left" severity="success" class="flex-1 lg:flex-none font-bold" :disabled="!modelValue" @click="openMutationForm('IN')" />
                <Button label="Barang Keluar" icon="pi pi-arrow-up-right" severity="danger" class="flex-1 lg:flex-none font-bold" :disabled="!modelValue" @click="openMutationForm('OUT')" />
            </div>
        </div>

        <div class="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm">
            <DataTable :value="currentWarehouseData?.products" :loading="dataLoading" stripedRows paginator :rows="10" class="p-datatable-sm">
                <template #empty>
                    <div class="p-8 text-center text-surface-500">
                        <i class="pi pi-box text-4xl mb-3 opacity-50 block"></i>
                        <span v-if="!modelValue">Pilih gudang di atas untuk melihat rekap mutasi.</span>
                        <span v-else>Gudang ini masih kosong.</span>
                    </div>
                </template>
                <Column header="Informasi Produk">
                    <template #body="{ data }">
                        <div class="font-bold text-surface-800">{{ data.name }}</div>
                        <div class="text-[10px] text-surface-500 mt-0.5">{{ data.barcode || '-' }}</div>
                    </template>
                </Column>
                <Column header="Total Masuk (IN)" class="text-center">
                    <template #body="{ data }"><span class="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">+ {{ data.total_in || 0 }}</span></template>
                </Column>
                <Column header="Total Keluar (OUT)" class="text-center">
                    <template #body="{ data }"><span class="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-lg">- {{ data.total_out || 0 }}</span></template>
                </Column>
                <Column header="Sisa (TOTAL)" alignFrozen="right" class="text-right">
                    <template #body="{ data }"><span class="font-black text-xl text-surface-900">{{ data.stock || 0 }}</span></template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="showMutationModal" modal :header="mutationType === 'IN' ? 'Input Barang Masuk' : 'Input Barang Keluar'" :style="{ width: '35rem' }">
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1 p-3 bg-surface-50 border border-surface-200 rounded-lg">
                    <label class="text-sm font-bold text-surface-800"><i class="pi pi-user mr-1 text-primary-500"></i> Penanggung Jawab</label>
                    <Dropdown v-model="mutationForm.userUuid" :options="users" optionLabel="name" optionValue="uuid" filter placeholder="Pilih User / PIC..." class="w-full border-primary-200" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Produk / Item</label>
                    <Dropdown v-model="mutationForm.productUuid" :options="products" optionLabel="name" optionValue="uuid" filter placeholder="Cari Produk..." class="w-full">
                        <template #option="slotProps">
                            <div class="flex flex-col">
                                <span class="font-semibold">{{ slotProps.option.name }}</span>
                                <span class="text-[10px] text-surface-500">{{ slotProps.option.barcode || 'No-Barcode' }}</span>
                            </div>
                        </template>
                    </Dropdown>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Lokasi Gudang</label>
                    <Dropdown v-model="mutationForm.warehouseUuid" :options="warehouses" optionLabel="name" optionValue="uuid" disabled class="w-full" />
                </div>
                <div v-if="mutationType === 'OUT'" class="flex flex-col gap-1">
                    <label class="text-sm font-semibold text-surface-600">Pilih Rak <span class="font-normal text-xs">(Opsional)</span></label>
                    <Dropdown v-model="mutationForm.shelveUuid" :options="shelves" optionLabel="name" optionValue="uuid" placeholder="Pilih Rak..." class="w-full" showClear />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Qty</label>
                    <InputNumber v-model="mutationForm.qty" showButtons :min="1" class="w-full" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Catatan</label>
                    <Textarea v-model="mutationForm.note" rows="2" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Batal" text severity="secondary" @click="showMutationModal = false" />
                <Button :label="'Simpan'" icon="pi pi-check" :severity="mutationType === 'IN' ? 'success' : 'danger'" :loading="mutationLoading" @click="submitMutation" />
            </template>
        </Dialog>
    </div>
</template>