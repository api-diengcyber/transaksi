<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const emit = defineEmits(['create', 'edit']);

const tableService = useTableService();
const toast = useToast();
const confirm = useConfirm();

const tables = ref([]);
const loading = ref(false);

const fetchTables = async () => {
    loading.value = true;
    try {
        const data = await tableService.getAllTables();
        tables.value = data || [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data meja', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const confirmDeleteTable = (event, table) => {
    event.stopPropagation();
    confirm.require({
        message: `Hapus Meja ${table.name}?`,
        header: 'Konfirmasi Hapus Meja',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await tableService.deleteTable(table.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Meja berhasil dihapus', life: 3000 });
                fetchTables();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus meja', life: 3000 });
            }
        }
    });
};

onMounted(() => {
    fetchTables();
});

defineExpose({ refresh: fetchTables });
</script>

<template>
    <div class="animate-fade-in">
        <div class="flex justify-between items-center mb-4">
             <h2 class="font-bold text-lg text-surface-700 dark:text-surface-100">Manajemen Meja Restoran</h2>
        </div>

        <div v-if="loading" class="flex justify-center py-10">
            <ProgressSpinner style="width: 50px; height: 50px" />
        </div>

        <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
            <div @click="emit('create')" class="rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 flex flex-col items-center justify-center text-center h-40 border-dashed border-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group">
                <div class="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-400 group-hover:bg-primary-50 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-3 transition-colors">
                    <i class="pi pi-plus text-xl"></i>
                </div>
                <span class="font-bold text-surface-600 dark:text-surface-400 group-hover:text-primary-600 text-sm">Tambah Meja</span>
            </div>

            <div v-for="table in tables" :key="table.uuid" 
                class="rounded-xl shadow-md bg-surface-0 dark:bg-surface-400 border border-surface-200 dark:border-surface-700 p-4 flex flex-col justify-between hover:border-primary-400 transition-all h-40 relative"
            >
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="emit('edit', table)" />
                    <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="(e) => confirmDeleteTable(e, table)" />
                </div>
                
                <div class="flex flex-col items-center justify-center h-full text-center group">
                    <i class="pi pi-table text-4xl text-primary-600 dark:text-primary-400 mb-2"></i>
                    <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100 line-clamp-1">{{ table.name }}</h3>
                    <p class="text-xs text-surface-500 mt-1">Kapasitas: {{ table.capacity }} Org</p>
                </div>
            </div>
            
            <div v-if="tables.length === 0 && !loading" class="col-span-full text-center py-10 text-surface-400 italic">
                Belum ada data meja.
            </div>
        </div>
    </div>
</template>