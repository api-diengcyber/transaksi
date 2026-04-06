<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useBrandService } from '~/composables/useBrandService'; // Pastikan composable ini sudah ada

const emit = defineEmits(['create', 'edit']);

const brandService = useBrandService();
const toast = useToast();
const confirm = useConfirm();

const brands = ref([]);
const loading = ref(false);
const searchQuery = ref('');

// Mengambil data dari API
const fetchBrands = async () => {
    loading.value = true;
    try {
        const res = await brandService.getAllBrands();
        // Menyesuaikan dengan format response standar API Anda
        brands.value = res?.data?.data || res?.data || res || [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data merek', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Fitur Pencarian Lokal
const filteredBrands = computed(() => {
    if (!searchQuery.value) return brands.value;
    const query = searchQuery.value.toLowerCase();
    return brands.value.filter(b => 
        b.name?.toLowerCase().includes(query) || 
        b.description?.toLowerCase().includes(query)
    );
});

// Konfirmasi dan Hapus Data
const confirmDelete = (brand) => {
    confirm.require({
        message: `Apakah Anda yakin ingin menghapus merek "${brand.name}"? Semua produk dengan merek ini akan kehilangan label mereknya.`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await brandService.deleteBrand(brand.uuid);
                toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Merek berhasil dihapus', life: 3000 });
                fetchBrands(); // Refresh tabel setelah hapus
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus merek', life: 3000 });
            }
        }
    });
};

onMounted(() => {
    fetchBrands();
});

// Mengekspos fungsi fetchBrands agar bisa dipanggil oleh parent (index.vue) setelah modal save
defineExpose({ fetchBrands, refresh: fetchBrands });
</script>

<template>
    <div class="bg-surface-0 p-4 md:p-6 rounded-xl shadow-sm border border-surface-200 animate-fade-in">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h2 class="text-xl font-bold text-surface-900">Daftar Merek (Brand)</h2>
                <p class="text-sm text-surface-500">Kelola master data merek produk yang dijual di toko Anda.</p>
            </div>
            <Button label="Tambah Merek" icon="pi pi-plus" @click="emit('create')" class="!font-bold" />
        </div>

        <div class="flex justify-end mb-4">
            <span class="p-input-icon-left w-full md:w-auto">
                <i class="pi pi-search text-surface-400" />
                <InputText v-model="searchQuery" placeholder="Cari merek..." class="w-full md:w-64" />
            </span>
        </div>

        <DataTable 
            :value="filteredBrands" 
            :loading="loading" 
            paginator 
            :rows="10" 
            :rowsPerPageOptions="[10, 20, 50]"
            stripedRows
            responsiveLayout="scroll"
            emptyMessage="Tidak ada data merek ditemukan."
            class="p-datatable-sm"
        >
            <Column field="name" header="Nama Merek" sortable style="min-width: 15rem">
                <template #body="{ data }">
                    <span class="font-bold text-surface-800">{{ data.name }}</span>
                </template>
            </Column>
            
            <Column field="description" header="Deskripsi">
                <template #body="{ data }">
                    <span class="text-surface-600 text-sm">{{ data.description || '-' }}</span>
                </template>
            </Column>

            <Column header="Aksi" :exportable="false" style="width: 8rem" alignFrozen="right" frozen>
                <template #body="{ data }">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" outlined rounded severity="warning" @click="emit('edit', data)" v-tooltip.top="'Edit'" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDelete(data)" v-tooltip.top="'Hapus'" />
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>