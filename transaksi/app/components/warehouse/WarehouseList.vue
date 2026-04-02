<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const warehouseService = useWarehouseService(); 
const toast = useToast();
const confirm = useConfirm();

const emit = defineEmits(['create', 'edit', 'view']);

const warehouses = ref([]);
const loading = ref(true);
const searchQuery = ref('');

const fetchWarehouses = async () => {
    loading.value = true;
    try {
        const res = await warehouseService.getAllWarehouses();
        warehouses.value = res?.data?.data || res?.data || res || [];
    } catch (error) {
        console.error("Error fetching warehouses:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data gudang' });
    } finally {
        loading.value = false;
    }
};

const deleteWarehouse = (event, warehouse) => {
    confirm.require({
        target: event.currentTarget,
        message: `Hapus gudang "${warehouse.name}"? Data stok di dalamnya mungkin akan terpengaruh.`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await warehouseService.deleteWarehouse(warehouse.uuid);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Gudang dihapus' });
                fetchWarehouses();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus gudang' });
            }
        }
    });
};

onMounted(() => {
    fetchWarehouses();
});

defineExpose({ fetchWarehouses });
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row justify-between gap-4 mb-4">
            <IconField iconPosition="left" class="w-full sm:w-72">
                <InputIcon class="pi pi-search" />
                <InputText v-model="searchQuery" placeholder="Cari nama gudang..." class="w-full" />
            </IconField>
            <Button label="Tambah Gudang" icon="pi pi-plus" @click="emit('create')" />
        </div>

        <DataTable :value="warehouses" :loading="loading" stripedRows responsiveLayout="scroll" class="border border-surface-200 rounded-lg overflow-hidden">
            <template #empty>
                <div class="p-8 text-center text-surface-400">
                    <i class="pi pi-building text-4xl mb-3 opacity-50 block"></i>
                    Belum ada data gudang/lokasi.
                </div>
            </template>

            <Column field="name" header="Nama Lokasi / Gudang">
                <template #body="{ data }">
                    <div class="font-bold text-surface-800">{{ data.name }}</div>
                </template>
            </Column>

            <Column field="location" header="Alamat / Detail Lokasi">
                <template #body="{ data }">
                    <div class="text-sm text-surface-600">
                        <i class="pi pi-map-marker mr-1 text-surface-400 text-xs"></i>
                        {{ data.location || 'Lokasi tidak diatur' }}
                    </div>
                </template>
            </Column>

            <Column header="Aksi" alignFrozen="right" class="w-32 text-center">
                <template #body="{ data }">
                    <div class="flex justify-center gap-1">
                        <Button icon="pi pi-box" text rounded severity="success" @click="emit('view', data)" v-tooltip.top="'Lihat Stok'" />
                        <Button icon="pi pi-pencil" text rounded severity="info" @click="emit('edit', data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="(e) => deleteWarehouse(e, data)" v-tooltip.top="'Hapus'" />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>
</template>