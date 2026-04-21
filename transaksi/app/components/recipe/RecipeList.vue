<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

// Import komponen modal agar bisa dimunculkan
import RecipeCreateModal from '~/components/recipe/RecipeCreateModal.vue';

const emit = defineEmits(['edit']);

const productService = useProductService();
const toast = useToast();

const products = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const recipeService = useRecipeService(); 

// --- STATE UNTUK MODAL ---
const isModalOpen = ref(false);
const selectedProduct = ref(null);

// [UPDATE]: Computed property untuk memfilter HANYA produk yang punya resep
const filteredProducts = computed(() => {
    return products.value.filter(p => p.hasRecipe === true);
});

const fetchProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();

        const menuProducts = data.data || data || [];
        
        products.value = menuProducts.map(p => {
            // [LOGIKA PENTING] 
            // Kita harus menentukan sendiri apakah produk ini punya resep atau tidak
            // Cek apakah backend mengirim array 'recipes' yang ada isinya
            const isRecipeExist = p.recipes && Array.isArray(p.recipes) && p.recipes.length > 0;

            return { 
                ...p,
                prices: p.prices || p.price || [],
                units: p.units || [],
                categories: (p.productCategory || []).map(pc => pc.category?.name).filter(Boolean),
                // Override nilai hasRecipe agar bisa dibaca oleh computed `filteredProducts`
                hasRecipe: isRecipeExist || p.hasRecipe === true || p.hasRecipe === 'true'
            };
        });
        
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data produk', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- FUNGSI KLIK TOMBOL ---
const openCreateModal = () => {
    selectedProduct.value = null; // Data kosong = Buat baru
    isModalOpen.value = true;
};

const openEditModal = (productData) => {
    selectedProduct.value = productData; // Isi data = Edit resep produk ini
    isModalOpen.value = true;
    emit('edit', productData); // Tetap emit jika parent membutuhkannya
};

onMounted(() => {
    fetchProducts();
});

defineExpose({ refresh: fetchProducts });
</script>

<template>
    <div class="animate-fade-in relative">
        <div class="flex justify-between items-center mb-4">
            <h2 class="font-bold text-lg ">Manajemen Resep (BOM)</h2>
            
            <Button 
                label="Buat Resep Baru" 
                icon="pi pi-plus" 
                severity="primary" 
                @click="openCreateModal" 
            />
        </div>
        
        <div class="relative w-full md:w-96 mb-4">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 "></i>
            <InputText v-model="filters['global'].value" placeholder="Cari Produk untuk atur Resep..." class="w-full pl-10 !rounded-full shadow-sm" />
        </div>

        <div class="card bg-surface-0 rounded-xl border border-surface-200 shadow-sm overflow-hidden">
             
             <DataTable :value="filteredProducts" :loading="loading" paginator :rows="10" dataKey="uuid" :filters="filters" stripedRows tableStyle="min-width: 60rem" class="text-sm datatable-dark-safe" :globalFilterFields="['name']">
                
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400 ">
                        <i class="pi pi-inbox text-5xl mb-3 opacity-30"></i>
                        <p>Belum ada produk yang memiliki resep tersimpan.</p>
                    </div>
                </template>

                <Column field="name" header="Nama Produk (Menu)" sortable style="width: 40%">
                    <template #body="slotProps">
                        <div class="flex items-center gap-3 py-2">
                            <i class="pi pi-utensils text-2xl text-orange-600 "></i>
                            <div>
                                <div class="font-bold text-base  leading-tight">{{ slotProps.data.name }}</div>
                                <div class="text-xs text-surface-500 ">{{ slotProps.data.categories.join(', ') || 'Non-Kategori' }}</div>
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column header="Status Resep" style="width: 30%">
                    <template #body="slotProps">
                        <Tag value="Tersedia" severity="success" class="text-xs" />
                    </template>
                </Column>

                <Column header="" style="width: 30%" class="text-right">
                    <template #body="slotProps">
                        <Button 
                            label="Edit Resep" 
                            icon="pi pi-pencil" 
                            severity="secondary" 
                            text 
                            @click="openEditModal(slotProps.data)" 
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <RecipeCreateModal
            :is-open="isModalOpen"
            :product-data="selectedProduct"
            @close="isModalOpen = false"
            @refresh="fetchProducts"
        />

    </div>
</template>