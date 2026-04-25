<script setup>
import { ref, watch } from 'vue';

const props = defineProps(['modelValue', 'warehouses']);
const emit = defineEmits(['update:modelValue']);
const warehouseService = useWarehouseService();

const historyList = ref([]);
const dataLoading = ref(false);

const loadHistory = async (uuid) => {
    if(!uuid) { historyList.value = []; return; }
    dataLoading.value = true;
    try {
        const res = await warehouseService.getWarehouseHistory(uuid);
        historyList.value = res?.data || res || [];
    } catch (err) {
        historyList.value = [];
    } finally {
        dataLoading.value = false;
    }
};

watch(() => props.modelValue, (newUuid) => loadHistory(newUuid), { immediate: true });
</script>

<template>
    <div class="p-4 md:p-6 flex flex-col gap-5">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-50 p-5 rounded-xl border border-surface-200">
            <div class="flex flex-col w-full md:w-1/3">
                <label class="text-xs font-bold text-surface-500 mb-2 uppercase">Lokasi Gudang</label>
                <Dropdown 
                    :modelValue="modelValue" 
                    @update:modelValue="emit('update:modelValue', $event)" 
                    :options="warehouses" 
                    optionLabel="name" optionValue="uuid" 
                    filter placeholder="Semua Lokasi" class="w-full" showClear 
                />
            </div>
            <Button label="Refresh Log" icon="pi pi-sync" outlined severity="secondary" :disabled="!modelValue" @click="loadHistory(modelValue)" />
        </div>

        <div class="border border-surface-200 rounded-xl overflow-hidden shadow-sm">
            <DataTable :value="historyList" :loading="dataLoading" stripedRows paginator :rows="15" class="p-datatable-sm">
                <template #empty>
                    <div class="p-10 text-center text-surface-500">
                        <i class="pi pi-folder-open text-4xl mb-3 opacity-50 block"></i>
                        <span v-if="!modelValue">Pilih gudang di atas untuk melihat riwayat.</span>
                        <span v-else>Belum ada log pergerakan transaksi di gudang ini.</span>
                    </div>
                </template>
                <Column field="date" header="Waktu" sortable>
                    <template #body="{ data }">
                        <div class="font-semibold">{{ data.date?.split(' ')[0] }}</div>
                        <div class="text-[11px] text-surface-500">{{ data.date?.split(' ')[1] }}</div>
                    </template>
                </Column>
                <Column field="ref" header="Referensi">
                    <template #body="{ data }"><span class="font-mono text-xs font-semibold bg-surface-100 px-2 py-1 rounded border">{{ data.ref.split('-')[0] }}</span></template>
                </Column>
                <Column field="product" header="Item"></Column>
                <Column field="type" header="Aktivitas" sortable>
                    <template #body="{ data }">
                        <Tag :severity="data.type === 'IN' ? 'success' : 'danger'" class="px-2 py-1 font-bold text-[10px]" rounded>
                            {{ data.type === 'IN' ? 'MASUK' : 'KELUAR' }}
                        </Tag>
                    </template>
                </Column>
                <Column field="qty" header="Stok" class="text-right">
                    <template #body="{ data }">
                        <span class="font-black text-lg" :class="data.type === 'IN' ? 'text-emerald-600' : 'text-red-600'">
                            {{ data.type === 'IN' ? '+' : '-' }}{{ data.qty }}
                        </span>
                    </template>
                </Column>
                <Column field="user" header="Operator"></Column>
            </DataTable>
        </div>
    </div>
</template>