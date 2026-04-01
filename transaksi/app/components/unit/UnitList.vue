<script setup>
import { ref, onMounted } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
// Pastikan useUnitService sudah dibuat di app/composables/useUnitService.ts
const unitService = useUnitService(); 

const emit = defineEmits(['create', 'edit']);

const confirm = useConfirm();
const toast = useToast();

const units = ref([]);
const loading = ref(false);

const loadUnits = async () => {
    loading.value = true;
    try {
        const res = await unitService.getAllUnits();
        // Sesuaikan dengan struktur response API Anda
        units.value = res.data || res || []; 
    } catch (error) {
        console.error("Gagal memuat data satuan:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Tidak dapat memuat data satuan' });
    } finally {
        loading.value = false;
    }
};

const confirmDelete = (event, uuid) => {
    confirm.require({
        target: event.currentTarget,
        message: 'Apakah Anda yakin ingin menghapus satuan ini?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        acceptClass: 'p-button-danger p-button-sm',
        rejectClass: 'p-button-secondary p-button-sm p-button-text',
        accept: async () => {
            try {
                await unitService.deleteUnit(uuid);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Satuan berhasil dihapus' });
                loadUnits();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus satuan' });
            }
        }
    });
};

onMounted(() => {
    loadUnits();
});

// Expose refresh method agar bisa dipanggil dari parent (index.vue)
defineExpose({ refresh: loadUnits });
</script>

<template>
    <div class="h-full flex flex-col animate-fade-in">
        <div class="flex justify-between items-center mb-4">
            <div>
                <h2 class="text-lg font-semibold text-surface-800">Daftar Satuan</h2>
                <p class="text-sm text-surface-500">Kelola satuan produk (Pcs, Dus, Pack, dll)</p>
            </div>
            <Button label="Tambah Satuan" icon="pi pi-plus" size="small" @click="emit('create')" />
        </div>

        <div class="flex-1 overflow-hidden bg-surface-0 border border-surface-200 rounded-xl">
            <DataTable 
                :value="units" 
                :loading="loading" 
                scrollable 
                scrollHeight="flex" 
                class="h-full p-datatable-sm" 
                stripedRows
            >
                <template #empty>
                    <div class="text-center py-8 text-surface-500">Tidak ada data satuan.</div>
                </template>
                
                <Column field="name" header="Nama Satuan" sortable></Column>
                
                <Column header="Aksi" :style="{ width: '120px' }" bodyStyle="text-align:center">
                    <template #body="{ data }">
                        <div class="flex gap-2 justify-center">
                            <Button 
                                icon="pi pi-pencil" 
                                text 
                                rounded 
                                severity="info" 
                                @click="emit('edit', data)" 
                                v-tooltip.top="'Edit'" 
                            />
                            <Button 
                                icon="pi pi-trash" 
                                text 
                                rounded 
                                severity="danger" 
                                @click="confirmDelete($event, data.uuid)" 
                                v-tooltip.top="'Hapus'" 
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>