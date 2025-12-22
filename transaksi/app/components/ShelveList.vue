<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const emit = defineEmits(['create', 'edit']);

const shelveService = useShelveService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const shelves = ref([]);
const loading = ref(false);

// --- STATE MODAL DETAIL ---
const showDetailModal = ref(false);
const selectedShelf = ref(null);
const detailLoading = ref(false);

// --- ACTIONS ---

const fetchShelves = async () => {
    loading.value = true;
    try {
        const data = await shelveService.getAllShelves();
        shelves.value = data || [];
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data rak', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// Fungsi Buka Modal Detail
const openDetail = async (shelf) => {
    showDetailModal.value = true;
    // Set data awal (nama/desc) agar UI tidak kosong saat loading
    selectedShelf.value = { ...shelf, productShelves: [] }; 
    detailLoading.value = true;

    try {
        // Fetch detail lengkap (termasuk list produk) by UUID
        const detailData = await shelveService.getShelve(shelf.uuid);
        selectedShelf.value = detailData;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat isi rak', life: 3000 });
    } finally {
        detailLoading.value = false;
    }
};

const confirmDeleteShelf = (event, shelf) => {
    event.stopPropagation(); // Mencegah modal terbuka saat tombol hapus diklik
    confirm.require({
        message: `Hapus Rak ${shelf.name}?`,
        header: 'Konfirmasi Hapus Rak',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await shelveService.deleteShelve(shelf.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Rak berhasil dihapus', life: 3000 });
                fetchShelves();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus rak', life: 3000 });
            }
        }
    });
};

const onEditClick = (event, shelf) => {
    event.stopPropagation(); // Mencegah modal terbuka saat tombol edit diklik
    emit('edit', shelf);
};

onMounted(() => {
    fetchShelves();
});

defineExpose({ refresh: fetchShelves });
</script>

<template>
    <div class="animate-fade-in">
        <div class="flex justify-between items-center mb-4">
             <h2 class="font-bold text-lg text-surface-700 dark:text-surface-100">Manajemen Lokasi Rak</h2>
        </div>

        <div v-if="loading" class="flex justify-center py-10">
            <ProgressSpinner style="width: 50px; height: 50px" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div @click="emit('create')" class="rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 flex flex-col items-center justify-center text-center h-56 border-dashed border-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group">
                <div class="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-400 group-hover:bg-primary-50 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-3 transition-colors">
                    <i class="pi pi-plus text-xl"></i>
                </div>
                <span class="font-bold text-surface-600 dark:text-surface-400 group-hover:text-primary-600">Buat Rak Baru</span>
            </div>

            <div v-for="shelf in shelves" :key="shelf.uuid" 
                @click="openDetail(shelf)"
                class="rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden group hover:shadow-md hover:border-primary-300 transition-all relative cursor-pointer h-56 flex flex-col"
            >
                <div class="h-1.5 bg-gradient-to-r from-blue-400 to-blue-600 w-full"></div>
                <div class="p-5 flex flex-col flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100 line-clamp-1">{{ shelf.name }}</h3>
                        <div class="flex -mr-2 -mt-1">
                            <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="(e) => onEditClick(e, shelf)" />
                            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="(e) => confirmDeleteShelf(e, shelf)" />
                        </div>
                    </div>

                    <p class="text-xs text-surface-500 dark:text-surface-400 mb-4 flex items-start gap-1 line-clamp-2 h-8">
                        <i class="pi pi-align-left text-[10px] mt-0.5 shrink-0"></i>
                        {{ shelf.description || 'Tidak ada deskripsi' }}
                    </p>

                    <div class="mt-auto space-y-2">
                        <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-400 p-2 rounded border border-surface-100 dark:border-surface-700">
                             <div class="flex items-center gap-2">
                                <i class="pi pi-box text-blue-500"></i>
                                <span class="text-xs font-medium">Kapasitas</span>
                            </div>
                            <span class="font-bold">{{ shelf.capacity || '∞' }}</span>
                        </div>

                        <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-400 p-2 rounded border border-surface-100 dark:border-surface-700">
                            <div class="flex items-center gap-2">
                                <i class="pi pi-tags text-emerald-500"></i>
                                <span class="text-xs font-medium">Total Item</span>
                            </div>
                            <span class="font-bold text-emerald-600">{{ shelf.totalItems || 0 }} Jenis</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-if="shelves.length === 0" class="col-span-full text-center py-10 text-surface-400 italic">
                Belum ada data rak.
            </div>
        </div>

        <Dialog v-model:visible="showDetailModal" modal :header="selectedShelf ? `Detail Rak: ${selectedShelf.name}` : 'Detail Rak'" :style="{ width: '600px' }" class="p-fluid">
            
            <div v-if="detailLoading" class="flex justify-center py-10">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>

            <div v-else-if="selectedShelf" class="space-y-4">
                <div class="grid grid-cols-2 gap-4 bg-surface-50 dark:bg-surface-400 p-4 rounded-lg border border-surface-100 dark:border-surface-700">
                    <div>
                        <label class="text-xs text-surface-500 block mb-1">Kapasitas Max</label>
                        <span class="font-bold text-lg">{{ selectedShelf.capacity || 'Tidak Terbatas' }}</span>
                    </div>
                    <div>
                        <label class="text-xs text-surface-500 block mb-1">Jenis Produk Disimpan</label>
                        <span class="font-bold text-lg text-primary-600">{{ selectedShelf.productShelves?.length || 0 }}</span>
                    </div>
                    <div class="col-span-2 border-t border-surface-200 dark:border-surface-600 pt-2 mt-1">
                         <p class="text-sm text-surface-600 dark:text-surface-300 italic">"{{ selectedShelf.description || 'Tidak ada deskripsi' }}"</p>
                    </div>
                </div>

                <div>
                    <h4 class="font-bold text-sm text-surface-700 dark:text-surface-200 mb-2 mt-4">Isi Rak Saat Ini</h4>
                    
                    <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
                        <div class="max-h-64 overflow-y-auto scrollbar-thin">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-surface-50 dark:bg-surface-400 text-xs uppercase text-surface-500 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-4 py-2">Produk</th>
                                        <th class="px-4 py-2">Satuan</th>
                                        <th class="px-4 py-2 text-right">Jumlah (Qty)</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-surface-100 dark:divide-surface-700">
                                    <tr v-for="item in selectedShelf.productShelves" :key="item.uuid" class="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                                        <td class="px-4 py-2 font-medium text-surface-700 dark:text-surface-100">
                                            {{ item.product?.name || 'Produk Terhapus' }}
                                        </td>
                                        <td class="px-4 py-2 text-surface-500">
                                            {{ item.unit?.unitName || '-' }}
                                        </td>
                                        <td class="px-4 py-2 text-right font-bold text-primary-600">
                                            {{ item.qty }}
                                        </td>
                                    </tr>
                                    <tr v-if="!selectedShelf.productShelves?.length">
                                        <td colspan="3" class="px-4 py-8 text-center text-surface-400 italic">
                                            Rak ini masih kosong.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Tutup" icon="pi pi-times" text @click="showDetailModal = false" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
/* Scrollbar tipis untuk tabel modal */
.scrollbar-thin::-webkit-scrollbar { width: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
</style>