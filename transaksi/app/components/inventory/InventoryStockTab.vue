<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    modelValue: String, // Ini akan mengikat selectedWarehouseUuid dari parent
    warehouses: Array
});
const emit = defineEmits(['update:modelValue']);

const warehouseService = useWarehouseService();
const toast = useToast();

const dataLoading = ref(false);
const currentWarehouseData = ref(null);

const loadData = async (uuid) => {
    if (!uuid) {
        currentWarehouseData.value = null;
        return;
    }
    dataLoading.value = true;
    try {
        const res = await warehouseService.getWarehouseStock(uuid);
        currentWarehouseData.value = res?.data || res;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail stok', life: 3000 });
    } finally {
        dataLoading.value = false;
    }
};

// Pantau perubahan Gudang dari Parent
watch(() => props.modelValue, (newUuid) => loadData(newUuid), { immediate: true });
</script>

<template>
    <div class="p-4 md:p-6 flex flex-col gap-5">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-50 dark:bg-surface-800 p-5 rounded-xl border border-surface-200 dark:border-surface-700">
            <div class="flex flex-col w-full lg:w-1/3">
                <label class="text-xs font-bold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wider">Filter Lokasi Gudang</label>
                <Dropdown 
                    :modelValue="modelValue" 
                    @update:modelValue="emit('update:modelValue', $event)"
                    :options="warehouses" 
                    optionLabel="name" 
                    optionValue="uuid" 
                    filter 
                    placeholder="Pilih Gudang..." 
                    class="w-full" 
                    showClear 
                />
            </div>

            <div v-if="currentWarehouseData" class="flex gap-8 w-full lg:w-auto lg:justify-end">
                <div class="text-left lg:text-right border-r border-surface-300 dark:border-surface-600 pr-8">
                    <div class="text-xs font-medium text-surface-500 mb-1">Kapasitas Maksimal</div>
                    <div class="font-bold text-2xl text-surface-800 dark:text-surface-100">{{ currentWarehouseData.capacity || 'Unlimited' }}</div>
                </div>
                <div class="text-left lg:text-right">
                    <div class="text-xs font-medium text-surface-500 mb-1">Item Tersimpan</div>
                    <div class="font-bold text-2xl text-primary-600 dark:text-primary-400">{{ currentWarehouseData.products?.length || 0 }}</div>
                </div>
            </div>
        </div>

        <div class="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm">
            <DataTable :value="currentWarehouseData?.products" :loading="dataLoading" stripedRows paginator :rows="10" class="p-datatable-sm" responsiveLayout="scroll">
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-surface-500">
                        <i class="pi pi-box text-5xl mb-4 opacity-50"></i>
                        <span v-if="!modelValue" class="font-medium text-lg">Silakan pilih gudang terlebih dahulu</span>
                        <span v-else class="font-medium text-lg">Gudang ini masih kosong</span>
                    </div>
                </template>

                <Column header="Informasi Produk" style="min-width: 20rem">
                    <template #body="{ data }">
                        <div class="flex items-center gap-3 py-1">
                            <div class="w-10 h-10 rounded-lg bg-surface-100 border flex items-center justify-center text-surface-400">
                                <i class="pi pi-image"></i>
                            </div>
                            <div>
                                <div class="font-bold text-surface-900">{{ data.name }}</div>
                                <div class="text-xs text-surface-500 mt-1 font-mono">
                                    <i class="pi pi-barcode text-[10px] mr-1"></i>{{ data.barcode || 'NO-BARCODE' }}
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>
                <Column header="Kategori">
                    <template #body="{ data }">
                        <Tag :value="data.category?.name || 'Umum'" severity="secondary" rounded class="font-medium px-3 text-xs" />
                    </template>
                </Column>
                <Column header="Ketersediaan" alignFrozen="right" class="text-right">
                    <template #body="{ data }">
                        <div class="flex items-center justify-end gap-2">
                            <div class="w-2 h-2 rounded-full" :class="(data.stock || 0) > 10 ? 'bg-emerald-500' : ((data.stock || 0) > 0 ? 'bg-orange-500' : 'bg-red-500')"></div>
                            <span class="font-black text-xl" :class="(data.stock || 0) > 0 ? 'text-surface-900' : 'text-red-500'">{{ data.stock || 0 }}</span>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>