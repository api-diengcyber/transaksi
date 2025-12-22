<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Service (Pastikan composable useCategoryService sudah dibuat sesuai instruksi sebelumnya)
const categoryService = useCategoryService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE DATA ---
const categories = ref([]);
const loading = ref(false);

// --- STATE MODAL FORM (CREATE/EDIT) ---
const showFormModal = ref(false);
const formLoading = ref(false);
const isEditMode = ref(false);
const selectedCategoryUuid = ref(null);

const form = ref({
    name: '',
    parentUuid: null,
    // [BARU] Tambahkan isRestaurant ke form
    isRestaurant: false
});

// --- STATE MODAL DETAIL (VIEW) ---
const showDetailModal = ref(false);
const selectedCategory = ref(null);
const detailLoading = ref(false);

// --- COMPUTED ---
// Opsi Parent untuk Dropdown: Filter agar kategori tidak bisa menjadi parent bagi dirinya sendiri
const parentOptions = computed(() => {
    if (!isEditMode.value) return categories.value.map(c => ({ label: c.name, value: c.uuid }));
    
    return categories.value
        .filter(c => c.uuid !== selectedCategoryUuid.value)
        .map(c => ({
            label: c.name,
            value: c.uuid
        }));
});

// --- ACTIONS: FETCH ---
const fetchCategories = async () => {
    loading.value = true;
    try {
        const data = await categoryService.getAllCategorys();
        categories.value = data || [];
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data kategori', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS: CREATE & EDIT ---
const openCreateModal = () => {
    isEditMode.value = false;
    selectedCategoryUuid.value = null;
    // [UPDATE] Reset isRestaurant default ke false
    form.value = { name: '', parentUuid: null, isRestaurant: false };
    showFormModal.value = true;
};

const openEditModal = (event, category) => {
    event.stopPropagation(); // Stop agar tidak membuka detail modal
    isEditMode.value = true;
    selectedCategoryUuid.value = category.uuid;
    
    // Pre-fill form
    form.value = {
        name: category.name,
        parentUuid: category.parent ? category.parent.uuid : null,
        // [UPDATE] Set nilai isRestaurant dari data
        isRestaurant: category.isRestaurant 
    };
    showFormModal.value = true;
};

const saveCategory = async () => {
    if (!form.value.name) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama kategori wajib diisi', life: 3000 });
        return;
    }

    formLoading.value = true;
    try {
        // [UPDATE] Kirim field isRestaurant
        const payload = { 
            name: form.value.name,
            parentUuid: form.value.parentUuid,
            isRestaurant: form.value.isRestaurant // Kirim state isRestaurant
        };

        if (isEditMode.value) {
            await categoryService.updateCategory(selectedCategoryUuid.value, payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Kategori diperbarui', life: 3000 });
        } else {
            await categoryService.createCategory(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Kategori baru dibuat', life: 3000 });
        }
        showFormModal.value = false;
        fetchCategories(); // Refresh grid
    } catch (err) {
        const msg = err.response?._data?.message || 'Terjadi kesalahan';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

// --- ACTIONS: DELETE ---
const confirmDelete = (event, category) => {
// ... existing confirmDelete function
    event.stopPropagation();
    confirm.require({
        message: `Hapus Kategori "${category.name}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await categoryService.deleteCategory(category.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Kategori berhasil dihapus', life: 3000 });
                fetchCategories();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus kategori', life: 3000 });
            }
        }
    });
};

// --- ACTIONS: DETAIL ---
const openDetail = async (category) => {
// ... existing openDetail function
    showDetailModal.value = true;
    selectedCategory.value = { ...category, productCategorys: [] }; 
    detailLoading.value = true;

    try {
        const detailData = await categoryService.getCategory(category.uuid);
        selectedCategory.value = detailData;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail kategori', life: 3000 });
    } finally {
        detailLoading.value = false;
    }
};

onMounted(() => {
    fetchCategories();
});

defineExpose({ refresh: fetchCategories });
</script>

<template>
    <div class="animate-fade-in">
        <div class="flex justify-between items-center mb-4">
             <h2 class="font-bold text-lg text-surface-700 dark:text-surface-100">Manajemen Kategori Produk</h2>
        </div>

        <div v-if="loading" class="flex justify-center py-10">
            <ProgressSpinner style="width: 50px; height: 50px" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            
            <div @click="openCreateModal" class="rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6 flex flex-col items-center justify-center text-center h-56 border-dashed border-2 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors group">
                <div class="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-400 group-hover:bg-primary-50 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-3 transition-colors">
                    <i class="pi pi-plus text-xl"></i>
                </div>
                <span class="font-bold text-surface-600 dark:text-surface-400 group-hover:text-primary-600">Buat Kategori Baru</span>
            </div>

            <div v-for="cat in categories" :key="cat.uuid" 
                @click="openDetail(cat)"
                class="rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden group hover:shadow-md hover:border-primary-300 transition-all relative cursor-pointer h-56 flex flex-col"
            >
                <div class="h-1.5 bg-gradient-to-r from-blue-400 to-blue-600 w-full"></div>
                
                <div class="p-5 flex flex-col flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100 line-clamp-1">{{ cat.name }}</h3>
                        <div class="flex -mr-2 -mt-1">
                            <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="(e) => openEditModal(e, cat)" />
                            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="(e) => confirmDelete(e, cat)" />
                        </div>
                    </div>

                    <p class="text-xs text-surface-500 dark:text-surface-400 mb-4 flex items-start gap-1 h-8">
                        <span v-if="cat.parent" class="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100">
                            <i class="pi pi-arrow-up text-[9px]"></i>
                            Induk: {{ cat.parent.name }}
                        </span>
                        <span v-else class="flex items-center gap-1 bg-surface-100 text-surface-500 px-2 py-1 rounded-md">
                            <i class="pi pi-folder text-[9px]"></i> Root Kategori
                        </span>
                    </p>
                    
                    <Tag v-if="cat.isRestaurant" value="Restaurant" severity="help" class="!text-[10px] !font-extrabold !px-2 w-fit mb-3"/>


                    <div class="mt-auto space-y-2">
                        <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-400 p-2 rounded border border-surface-100 dark:border-surface-700">
                             <div class="flex items-center gap-2">
                                <i class="pi pi-calendar text-blue-500"></i>
                                <span class="text-xs font-medium">Dibuat</span>
                            </div>
                            <span class="font-bold text-xs">{{ new Date(cat.createdAt).toLocaleDateString('id-ID') }}</span>
                        </div>

                        <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-400 p-2 rounded border border-surface-100 dark:border-surface-700">
                            <div class="flex items-center gap-2">
                                <i class="pi pi-tags text-emerald-500"></i>
                                <span class="text-xs font-medium">Total Produk</span>
                            </div>
                            <span class="font-bold text-emerald-600">{{ cat.totalItems || 0 }} Item</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-if="categories.length === 0" class="col-span-full text-center py-10 text-surface-400 italic">
                Belum ada data kategori.
            </div>
        </div>

        <Dialog v-model:visible="showFormModal" modal :header="isEditMode ? 'Edit Kategori' : 'Kategori Baru'" :style="{ width: '450px' }" class="p-fluid">
            <div class="mt-2 space-y-4">
                <div class="field">
                    <label for="name" class="block text-sm font-medium mb-1">Nama Kategori</label>
                    <InputText id="name" v-model="form.name" required autofocus placeholder="Contoh: Makanan Ringan" class="w-full" />
                </div>

                <div class="field">
                    <label for="parent" class="block text-sm font-medium mb-1">Induk Kategori (Parent)</label>
                    <Dropdown 
                        id="parent" 
                        v-model="form.parentUuid" 
                        :options="parentOptions" 
                        optionLabel="label" 
                        optionValue="value" 
                        placeholder="Pilih Parent (Opsional)" 
                        showClear
                        filter
                        class="w-full"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <i class="pi pi-folder mr-2 text-yellow-500"></i>
                                <div>{{ slotProps.option.label }}</div>
                            </div>
                        </template>
                    </Dropdown>
                    <small class="text-surface-500 block mt-1">Kosongkan jika ini adalah kategori utama.</small>
                </div>
                
                <div class="field flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg">
                    <div>
                        <label for="isRestaurant" class="block text-sm font-bold text-surface-800 dark:text-surface-100">Kategori Restoran / Resep</label>
                        <small class="text-surface-500 block">Menandai ini sebagai bahan baku/menu untuk keperluan Resep (BOM).</small>
                    </div>
                    <InputSwitch id="isRestaurant" v-model="form.isRestaurant" class="shrink-0" />
                </div>

            </div>

            <template #footer>
                <Button label="Batal" icon="pi pi-times" text @click="showFormModal = false" />
                <Button label="Simpan" icon="pi pi-check" :loading="formLoading" @click="saveCategory" />
            </template>
        </Dialog>

        <Dialog v-model:visible="showDetailModal" modal :header="selectedCategory ? `Detail: ${selectedCategory.name}` : 'Detail Kategori'" :style="{ width: '600px' }" class="p-fluid">
            
            <div v-if="detailLoading" class="flex justify-center py-10">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>

            <div v-else-if="selectedCategory" class="space-y-4">
                <div class="grid grid-cols-2 gap-4 bg-surface-50 dark:bg-surface-400 p-4 rounded-lg border border-surface-100 dark:border-surface-700">
                    <div>
                        <label class="text-xs text-surface-500 block mb-1">Induk Kategori</label>
                        <span class="font-bold text-lg text-blue-600">{{ selectedCategory.parent ? selectedCategory.parent.name : 'Root (Utama)' }}</span>
                    </div>
                    <div>
                        <label class="text-xs text-surface-500 block mb-1">Jenis Kategori</label>
                        <span v-if="selectedCategory.isRestaurant" class="font-bold text-lg text-purple-600 flex items-center gap-1">
                            <i class="pi pi-utensils text-sm"></i> Restoran
                        </span>
                        <span v-else class="font-bold text-lg text-surface-800 dark:text-surface-100">Retail Umum</span>
                    </div>
                    <div>
                        <label class="text-xs text-surface-500 block mb-1">Jumlah Produk</label>
                        <span class="font-bold text-lg text-emerald-600">{{ selectedCategory.productCategorys?.length || 0 }}</span>
                    </div>
                </div>

                <div>
                    <h4 class="font-bold text-sm text-surface-700 dark:text-surface-200 mb-2 mt-4">Daftar Produk</h4>
                    
                    <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
                        <div class="max-h-64 overflow-y-auto scrollbar-thin">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-surface-50 dark:bg-surface-400 text-xs uppercase text-surface-500 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-4 py-2">Nama Produk</th>
                                        <th class="px-4 py-2 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-surface-100 dark:divide-surface-700 bg-surface-0 dark:bg-surface-400">
                                    <tr v-for="item in selectedCategory.productCategorys" :key="item.uuid" class="hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                                        <td class="px-4 py-2 font-medium text-surface-700 dark:text-surface-100">
                                            {{ item.product?.name || 'Produk Terhapus' }}
                                        </td>
                                        <td class="px-4 py-2 text-right">
                                            <Tag value="Aktif" severity="success" class="text-[10px]" />
                                        </td>
                                    </tr>
                                    <tr v-if="!selectedCategory.productCategorys?.length">
                                        <td colspan="2" class="px-4 py-8 text-center text-surface-400 italic">
                                            Kategori ini belum memiliki produk.
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