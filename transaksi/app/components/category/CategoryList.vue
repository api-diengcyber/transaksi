<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// --- INJECT SERVICES ---
const categoryService = useCategoryService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE DATA ---
const categories = ref([]);
const loading = ref(false);
const searchQuery = ref(''); // State untuk search box

// --- STATE MODAL FORM (CREATE/EDIT) ---
const showFormModal = ref(false);
const formLoading = ref(false);
const isEditMode = ref(false);
const selectedCategoryUuid = ref(null);

const form = ref({
    name: '',
    parentUuid: null,
    isRestaurant: false
});

// --- STATE MODAL DETAIL (VIEW) ---
const showDetailModal = ref(false);
const selectedCategory = ref(null);
const detailLoading = ref(false);

// --- COMPUTED ---

// 1. Filter Kategori berdasarkan Search Query
const filteredCategories = computed(() => {
    if (!searchQuery.value) return categories.value;
    const lowerSearch = searchQuery.value.toLowerCase();
    return categories.value.filter(c => 
        c.name.toLowerCase().includes(lowerSearch)
    );
});

// 2. Opsi Parent untuk Dropdown
const parentOptions = computed(() => {
    // Filter: Kategori tidak boleh menjadi parent bagi dirinya sendiri
    let opts = categories.value;
    if (isEditMode.value && selectedCategoryUuid.value) {
        opts = opts.filter(c => c.uuid !== selectedCategoryUuid.value);
    }
    return opts.map(c => ({ label: c.name, value: c.uuid }));
});

// --- ACTIONS: FETCH ---
const fetchCategories = async () => {
    loading.value = true;
    try {
        const data = await categoryService.getAllCategorys();
        // Pastikan data array
        categories.value = Array.isArray(data) ? data : (data.data || []);
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data kategori', life: 3000 });
        categories.value = [];
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS: CREATE & EDIT ---
const openCreateModal = () => {
    isEditMode.value = false;
    selectedCategoryUuid.value = null;
    form.value = { name: '', parentUuid: null, isRestaurant: false };
    showFormModal.value = true;
};

const openEditModal = (event, category) => {
    event.stopPropagation(); 
    isEditMode.value = true;
    selectedCategoryUuid.value = category.uuid;
    
    form.value = {
        name: category.name,
        parentUuid: category.parent ? category.parent.uuid : null,
        isRestaurant: !!category.isRestaurant 
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
        const payload = { 
            name: form.value.name,
            parentUuid: form.value.parentUuid || null, // Kirim null jika kosong
            isRestaurant: form.value.isRestaurant
        };

        if (isEditMode.value) {
            await categoryService.updateCategory(selectedCategoryUuid.value, payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Kategori diperbarui', life: 3000 });
        } else {
            await categoryService.createCategory(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Kategori baru dibuat', life: 3000 });
        }
        showFormModal.value = false;
        fetchCategories(); 
    } catch (err) {
        const msg = err.response?._data?.message || err.message || 'Terjadi kesalahan';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

// --- ACTIONS: DELETE ---
const confirmDelete = (event, category) => {
    event.stopPropagation();
    confirm.require({
        target: event.currentTarget,
        message: `Hapus Kategori "${category.name}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await categoryService.deleteCategory(category.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Kategori berhasil dihapus', life: 3000 });
                fetchCategories();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus kategori. Mungkin masih ada produk terkait.', life: 3000 });
            }
        }
    });
};

// --- ACTIONS: DETAIL ---
const openDetail = async (category) => {
    showDetailModal.value = true;
    selectedCategory.value = null; // Reset dulu agar loading terlihat
    detailLoading.value = true;

    try {
        const detailData = await categoryService.getCategory(category.uuid);
        selectedCategory.value = detailData;
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail kategori', life: 3000 });
        showDetailModal.value = false;
    } finally {
        detailLoading.value = false;
    }
};

onMounted(() => {
    fetchCategories();
});
</script>

<template>
    <div class="flex flex-col gap-6 p-2">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-0 p-4 rounded-xl border border-surface-200 shadow-sm">
            <div>
                <h2 class="font-bold text-xl text-surface-900">Kategori Produk</h2>
                <p class="text-sm text-surface-500">Kelola pengelompokan produk Anda</p>
            </div>

            <div class="flex gap-3 w-full md:w-auto">
                <span class="relative w-full md:w-64">
                    <i class="pi pi-search absolute top-1/2 left-3 -translate-y-1/2 text-surface-400"></i>
                    <InputText v-model="searchQuery" placeholder="Cari Kategori..." class="pl-10 w-full !rounded-full" />
                </span>
                <Button label="Baru" icon="pi pi-plus" severity="primary" rounded @click="openCreateModal" />
            </div>
        </div>

        <div v-if="loading" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <Skeleton v-for="i in 4" :key="i" height="12rem" class="!rounded-xl" />
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            
            <div v-if="filteredCategories.length === 0" class="col-span-full flex flex-col items-center justify-center py-16 bg-surface-50 rounded-xl border border-dashed border-surface-300">
                <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                    <i class="pi pi-filter-slash text-2xl text-surface-400"></i>
                </div>
                <p class="text-surface-600 font-medium">Tidak ada kategori ditemukan.</p>
                <Button v-if="searchQuery" label="Reset Pencarian" text size="small" @click="searchQuery = ''" class="mt-2" />
            </div>

            <div 
                v-for="cat in filteredCategories" 
                :key="cat.uuid" 
                @click="openDetail(cat)"
                class="group relative bg-surface-0 rounded-xl border border-surface-200 shadow-sm hover:shadow-lg hover:border-primary-300 transition-all cursor-pointer overflow-hidden flex flex-col h-52"
            >
                <div class="h-1.5 w-full" :class="cat.parent ? 'bg-blue-500' : 'bg-primary-500'"></div>
                
                <div class="p-5 flex flex-col h-full">
                    <div class="flex justify-between items-start mb-2">
                        <div class="pr-2">
                            <h3 class="font-bold text-lg text-surface-800 line-clamp-1 group-hover:text-primary-600 transition-colors" :title="cat.name">
                                {{ cat.name }}
                            </h3>
                            <div class="flex gap-1 mt-1">
                                <Tag v-if="!cat.parent" value="Root" severity="secondary" class="!text-[10px] !px-2" />
                                <Tag v-else :value="cat.parent.name" severity="info" icon="pi pi-arrow-up" class="!text-[10px] !px-2 max-w-[120px] truncate" />
                            </div>
                        </div>
                        
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-2 bg-surface-0/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
                            <Button icon="pi pi-pencil" text rounded size="small" severity="info" @click="(e) => openEditModal(e, cat)" class="!w-7 !h-7" v-tooltip.top="'Edit'" />
                            <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="(e) => confirmDelete(e, cat)" class="!w-7 !h-7" v-tooltip.top="'Hapus'" />
                        </div>
                    </div>

                    <div class="mt-2 mb-auto">
                        <Tag v-if="cat.isRestaurant" value="Menu Resto" severity="warning" icon="pi pi-utensils" class="!text-[10px] !font-bold" />
                    </div>

                    <div class="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center text-xs text-surface-500">
                        <span class="flex items-center gap-1">
                            <i class="pi pi-clock"></i> {{ new Date(cat.createdAt).toLocaleDateString('id-ID') }}
                        </span>
                        <span class="flex items-center gap-1 font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                            {{ cat.totalItems || cat.products?.length || 0 }} Item
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <Dialog 
            v-model:visible="showFormModal" 
            modal 
            :header="isEditMode ? 'Edit Kategori' : 'Tambah Kategori Baru'" 
            :style="{ width: '450px' }" 
            class="p-fluid"
        >
            <div class="flex flex-col gap-5 pt-2">
                
                <div class="field">
                    <label for="name" class="font-semibold text-sm mb-1 block">Nama Kategori <span class="text-red-500">*</span></label>
                    <InputText id="name" v-model="form.name" required autofocus placeholder="Contoh: Minuman Dingin" class="w-full" />
                </div>

                <div class="field">
                    <label for="parent" class="font-semibold text-sm mb-1 block">Induk Kategori (Parent)</label>
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
                            <div class="flex items-center gap-2">
                                <i class="pi pi-folder text-yellow-500"></i>
                                <span>{{ slotProps.option.label }}</span>
                            </div>
                        </template>
                    </Dropdown>
                    <small class="text-surface-500">Kosongkan jika ini adalah kategori utama.</small>
                </div>
                
                <div class="field bg-surface-50 p-3 rounded-lg border border-surface-200 flex items-center justify-between">
                    <div>
                        <label for="isRestaurant" class="font-bold text-sm block text-surface-800">Mode Restoran / Dapur</label>
                        <small class="text-surface-500 text-xs">Aktifkan jika kategori ini untuk menu makanan/bahan baku resep.</small>
                    </div>
                    <InputSwitch id="isRestaurant" v-model="form.isRestaurant" />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="showFormModal = false" />
                    <Button label="Simpan" icon="pi pi-check" :loading="formLoading" @click="saveCategory" severity="primary" />
                </div>
            </template>
        </Dialog>

        <Dialog 
            v-model:visible="showDetailModal" 
            modal 
            header="Detail Kategori" 
            :style="{ width: '600px' }" 
            class="p-fluid"
        >
            <div v-if="detailLoading" class="flex justify-center py-10">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>

            <div v-else-if="selectedCategory" class="flex flex-col gap-4">
                <div class="bg-primary-50 p-4 rounded-xl border border-primary-100 flex items-start gap-4">
                    <div class="w-12 h-12 rounded-full bg-white text-primary-600 flex items-center justify-center text-xl shadow-sm font-bold">
                        {{ selectedCategory.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-primary-900">{{ selectedCategory.name }}</h3>
                        <div class="flex gap-2 mt-1">
                            <Tag :value="selectedCategory.parent ? `Sub dari: ${selectedCategory.parent.name}` : 'Root Category'" :severity="selectedCategory.parent ? 'info' : 'secondary'" class="!text-[10px]" />
                            <Tag v-if="selectedCategory.isRestaurant" value="Restoran" severity="warning" class="!text-[10px]" />
                        </div>
                    </div>
                </div>

                <div>
                    <h4 class="font-bold text-sm text-surface-700 mb-2 flex justify-between items-center">
                        <span>Produk dalam Kategori ini</span>
                        <Badge :value="selectedCategory.products?.length || 0" severity="success" />
                    </h4>
                    
                    <div class="border border-surface-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                        <ul class="divide-y divide-surface-100 bg-surface-0">
                            <li v-for="prod in selectedCategory.products" :key="prod.uuid" class="p-3 hover:bg-surface-50 flex items-center gap-3">
                                <i class="pi pi-box text-surface-400"></i>
                                <span class="text-sm font-medium text-surface-700">{{ prod.name }}</span>
                            </li>
                            <li v-if="!selectedCategory.products?.length" class="p-6 text-center text-surface-400 italic text-sm">
                                Tidak ada produk.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Tutup" icon="pi pi-times" text severity="secondary" @click="showDetailModal = false" />
            </template>
        </Dialog>
    </div>
</template>