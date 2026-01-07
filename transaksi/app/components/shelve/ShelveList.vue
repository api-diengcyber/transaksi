<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// [UPDATED] Tambahkan Prop fixedFilter
const props = defineProps({
    fixedFilter: {
        type: String,
        default: null // Bisa diisi 'WAREHOUSE' atau 'SHELF'
    }
});

const emit = defineEmits(['create', 'edit', 'delete', 'view']);

const shelveService = useShelveService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const shelves = ref([]);
const loading = ref(false);
const viewMode = ref('grid'); // 'grid' | 'list'

// Inisialisasi filterType berdasarkan props
const filterType = ref(props.fixedFilter || ''); 

// [UPDATED] Watcher jika props berubah dinamis
watch(() => props.fixedFilter, (newVal) => {
    if (newVal) filterType.value = newVal;
});

// --- COMPUTED ---
const filteredShelves = computed(() => {
    // Jika ada fixedFilter dari props, paksakan filter tersebut
    const type = props.fixedFilter || filterType.value;
    
    if (!type) return shelves.value;
    return shelves.value.filter(item => item.type === type);
});

// --- ACTIONS ---
const fetchShelves = async () => {
    loading.value = true;
    try {
        const data = await shelveService.getAllShelves(); 
        shelves.value = data || [];
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const confirmDeleteShelf = (event, shelf) => {
    event.stopPropagation();
    
    if (shelf.isDefault) {
        toast.add({ severity: 'warn', summary: 'Akses Ditolak', detail: 'Lokasi Utama tidak dapat dihapus', life: 3000 });
        return;
    }

    confirm.require({
        message: `Hapus ${shelf.name}?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await shelveService.deleteShelve(shelf.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Berhasil dihapus', life: 3000 });
                fetchShelves();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus', life: 3000 });
            }
        }
    });
};

const onEditClick = (event, shelf) => {
    event.stopPropagation();
    emit('edit', shelf);
};

const onCardClick = (shelf) => {
    emit('view', shelf);
};

onMounted(() => {
    fetchShelves();
});

defineExpose({ refresh: fetchShelves });
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div v-if="fixedFilter">
                <h2 class="font-bold text-2xl ">
                    {{ fixedFilter === 'SHELF' ? 'Daftar Rak Pajangan' : 'Manajemen Lokasi' }}
                </h2>
                <p class="text-sm text-surface-500">
                    {{ fixedFilter === 'SHELF' ? 'Kelola lokasi rak untuk produk display' : 'Kelola Gudang Penyimpanan dan Rak Pajangan Toko' }}
                </p>
             </div>
             
             <div class="flex flex-wrap items-center gap-3">
                 <div v-if="!fixedFilter" class="bg-surface-100 p-1 rounded-lg flex gap-1">
                    <button 
                        @click="filterType = ''"
                        class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                        :class="filterType === '' ? 'bg-surface-0 shadow-sm text-primary-600' : 'text-surface-500 hover:text-surface-700'"
                    >
                        Semua
                    </button>
                    <button 
                        @click="filterType = 'WAREHOUSE'"
                        class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1"
                        :class="filterType === 'WAREHOUSE' ? 'bg-surface-0 shadow-sm text-blue-600' : 'text-surface-500 hover:text-surface-700'"
                    >
                        <i class="pi pi-building text-[10px]"></i> Gudang
                    </button>
                    <button 
                        @click="filterType = 'SHELF'"
                        class="px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1"
                        :class="filterType === 'SHELF' ? 'bg-surface-0 shadow-sm text-emerald-600' : 'text-surface-500 hover:text-surface-700'"
                    >
                        <i class="pi pi-th-large text-[10px]"></i> Rak
                    </button>
                 </div>

                 <div class="flex items-center gap-2">
                    <div class="border border-surface-300 rounded-lg overflow-hidden flex">
                        <button 
                            @click="viewMode = 'grid'"
                            class="p-2 transition-colors hover:bg-surface-100 "
                            :class="viewMode === 'grid' ? 'bg-surface-100 text-primary-600' : 'text-surface-500'"
                            title="Tampilan Grid"
                        >
                            <i class="pi pi-th-large"></i>
                        </button>
                        <div class="w-[1px] bg-surface-300 "></div>
                        <button 
                            @click="viewMode = 'list'"
                            class="p-2 transition-colors hover:bg-surface-100 "
                            :class="viewMode === 'list' ? 'bg-surface-100 text-primary-600' : 'text-surface-500'"
                            title="Tampilan List"
                        >
                            <i class="pi pi-list"></i>
                        </button>
                    </div>

                    <Button label="Tambah Baru" icon="pi pi-plus" size="small" @click="emit('create')" />
                 </div>
             </div>
        </div>

        <div v-if="loading" class="flex justify-center py-20">
            <ProgressSpinner style="width: 50px; height: 50px" />
        </div>

        <div v-else>
            <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div @click="emit('create')" class="rounded-xl shadow-sm border border-surface-200  p-6 flex flex-col items-center justify-center text-center h-64 border-dashed border-2 cursor-pointer hover:bg-surface-50  transition-colors group">
                    <div class="w-14 h-14 rounded-full bg-surface-100 group-hover:bg-primary-50 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-4 transition-colors">
                        <i class="pi pi-plus text-xl"></i>
                    </div>
                    <span class="font-bold text-lg text-surface-600  group-hover:text-primary-600">
                        {{ fixedFilter === 'SHELF' ? 'Tambah Rak' : 'Tambah Lokasi' }}
                    </span>
                    <span class="text-xs text-surface-400 mt-1">
                        {{ fixedFilter === 'SHELF' ? 'Buat rak pajang baru' : 'Gudang atau Rak Baru' }}
                    </span>
                </div>

                <div v-for="shelf in filteredShelves" :key="shelf.uuid" 
                    @click="onCardClick(shelf)"
                    class="rounded-xl shadow-sm border border-surface-200  overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative cursor-pointer h-64 flex flex-col bg-surface-0 "
                >
                    <div class="h-2 w-full" :class="shelf.type === 'WAREHOUSE' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-emerald-400 to-teal-600'"></div>
                    
                    <div class="p-5 flex flex-col flex-1 relative">
                        <div v-if="shelf.isDefault" class="absolute top-4 right-4 z-10">
                            <span class="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200 flex items-center gap-1 shadow-sm">
                                <i class="pi pi-star-fill text-[8px]"></i> UTAMA
                            </span>
                        </div>

                        <div class="flex items-start gap-3 mb-3">
                            <div class="p-2 rounded-lg shrink-0 mt-1" :class="shelf.type === 'WAREHOUSE' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'">
                                <i class="text-lg" :class="shelf.type === 'WAREHOUSE' ? 'pi pi-building' : 'pi pi-th-large'"></i>
                            </div>
                            <div class="pr-12">
                                <h3 class="font-bold text-lg  leading-tight line-clamp-2">{{ shelf.name }}</h3>
                                <span class="text-[10px] font-bold tracking-wider uppercase opacity-60">
                                    {{ shelf.type === 'WAREHOUSE' ? 'Gudang Penyimpanan' : 'Rak Pajangan' }}
                                </span>
                            </div>
                        </div>

                        <p class="text-xs text-surface-500  mb-4 line-clamp-2 h-8 leading-relaxed">
                            {{ shelf.description || 'Tidak ada deskripsi tambahan.' }}
                        </p>

                        <div class="mt-auto pt-3 border-t border-surface-100  flex items-end justify-between">
                            <div class="flex flex-col gap-1">
                                <div class="text-xs text-surface-400">Kapasitas: <span class="font-semibold ">{{ shelf.capacity || '∞' }}</span></div>
                                <div class="text-xs text-surface-400">Terisi: <span class="font-bold" :class="shelf.totalItems > 0 ? 'text-primary-600' : 'text-surface-500'">{{ shelf.totalItems || 0 }} Item</span></div>
                            </div>

                            <div class="flex gap-1">
                                <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="(e) => onEditClick(e, shelf)" />
                                <Button 
                                    icon="pi pi-trash" 
                                    text rounded 
                                    size="small" 
                                    :severity="shelf.isDefault ? 'secondary' : 'danger'" 
                                    :disabled="shelf.isDefault"
                                    :class="shelf.isDefault ? 'opacity-30 cursor-not-allowed' : ''"
                                    @click="(e) => confirmDeleteShelf(e, shelf)" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="viewMode === 'list'" class="bg-surface-0  rounded-xl border border-surface-200  overflow-hidden shadow-sm">
                <table class="w-full text-left text-sm">
                    <thead class="bg-surface-50 border-b border-surface-200  text-surface-500 font-medium text-xs uppercase tracking-wider">
                        <tr>
                            <th class="p-4 w-12">#</th>
                            <th class="p-4">Nama & Lokasi</th>
                            <th class="p-4 w-40">Tipe</th>
                            <th class="p-4 w-32">Kapasitas</th>
                            <th class="p-4 w-32">Status Item</th>
                            <th class="p-4 w-32 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100">
                        <tr v-for="(shelf, index) in filteredShelves" :key="shelf.uuid" @click="onCardClick(shelf)" class="hover:bg-surface-50  cursor-pointer transition-colors group">
                            <td class="p-4 text-surface-400 text-xs">{{ index + 1 }}</td>
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-lg shrink-0" :class="shelf.type === 'WAREHOUSE' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'">
                                        <i :class="shelf.type === 'WAREHOUSE' ? 'pi pi-building' : 'pi pi-th-large'"></i>
                                    </div>
                                    <div>
                                        <div class="font-bold  flex items-center gap-2">
                                            {{ shelf.name }}
                                            <span v-if="shelf.isDefault" class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200 leading-none">UTAMA</span>
                                        </div>
                                        <div class="text-xs text-surface-500 truncate max-w-[250px]">{{ shelf.description || '-' }}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4">
                                <span class="text-xs font-bold px-2 py-1 rounded-full border" 
                                    :class="shelf.type === 'WAREHOUSE' ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'">
                                    {{ shelf.type === 'WAREHOUSE' ? 'GUDANG PENYIMPANAN' : 'RAK PAJANGAN' }}
                                </span>
                            </td>
                            <td class="p-4 text-surface-600">
                                {{ shelf.capacity ? shelf.capacity + ' Item' : 'Tak Terbatas' }}
                            </td>
                            <td class="p-4">
                                <div class="flex items-center gap-2">
                                    <div class="w-2 h-2 rounded-full" :class="shelf.totalItems > 0 ? 'bg-green-500' : 'bg-gray-300'"></div>
                                    <span :class="shelf.totalItems > 0 ? 'text-surface-900 font-semibold' : 'text-surface-400'">
                                        {{ shelf.totalItems || 0 }} Jenis
                                    </span>
                                </div>
                            </td>
                            <td class="p-4 text-right">
                                <div class="flex justify-end gap-1 opacity-100">
                                    <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="(e) => onEditClick(e, shelf)" v-tooltip.top="'Edit'" />
                                    <Button 
                                        icon="pi pi-trash" 
                                        text rounded 
                                        size="small" 
                                        severity="danger" 
                                        :disabled="shelf.isDefault" 
                                        @click="(e) => confirmDeleteShelf(e, shelf)" 
                                        v-tooltip.top="shelf.isDefault ? 'Tidak bisa dihapus' : 'Hapus'"
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr v-if="filteredShelves.length === 0">
                            <td colspan="6" class="p-12 text-center text-surface-400">
                                <div class="flex flex-col items-center gap-2">
                                    <i class="pi pi-search text-2xl opacity-50"></i>
                                    <span>Tidak ada data lokasi ditemukan.</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="filteredShelves.length === 0 && viewMode === 'grid'" class="col-span-full py-12 flex flex-col items-center justify-center text-surface-400 border-2 border-dashed border-surface-200 rounded-xl">
                <i class="pi pi-search text-4xl mb-3 opacity-50"></i>
                <p>Tidak ada data {{ fixedFilter === 'SHELF' ? 'rak' : 'lokasi' }} ditemukan.</p>
                <Button label="Reset Filter" text size="small" class="mt-2" @click="filterType = ''" v-if="!fixedFilter && filterType" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>