<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const emit = defineEmits(['edit']);

const productService = useProductService();
const toast = useToast();

const products = ref([]); // Hanya produk yang mungkin punya resep
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const recipeService = useRecipeService(); 

// Data mapping resep (untuk info sekilas)
const recipeInfoMap = ref({});

const fetchProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        
        // Asumsi: Produk adalah 'Menu' jika memiliki kategori isRestaurant: true
        const menuProducts = (data || []).filter(p => 
            (p.productCategory || []).some(pc => pc.category?.isRestaurant)
        );
        
        products.value = menuProducts.map(p => ({ // [UPDATE] Filter hanya menu
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            categories: (p.productCategory || []).map(pc => pc.category?.name).filter(Boolean)
        }));
        
        // Asumsi: kita bisa fetch resep per produk jika ada API yang sesuai
        // Untuk demo, kita skip fetching resep dan hanya tampilkan list produk
        
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data produk', life: 3000 });
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchProducts();
});

defineExpose({ refresh: fetchProducts });
</script>

<template>
    <div class="animate-fade-in">
        <div class="flex justify-between items-center mb-4">
            <h2 class="font-bold text-lg text-surface-700 dark:text-surface-100">Manajemen Resep (BOM)</h2>
        </div>
        
        <div class="relative w-full md:w-96 mb-4">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500"></i>
            <InputText v-model="filters['global'].value" placeholder="Cari Produk untuk atur Resep..." class="w-full pl-10 !rounded-full shadow-sm" />
        </div>

        <div class="card bg-surface-0 dark:bg-surface-100 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
             
             <DataTable :value="products" :loading="loading" paginator :rows="10" dataKey="uuid" :filters="filters" stripedRows tableStyle="min-width: 60rem" class="text-sm datatable-dark-safe" :globalFilterFields="['name']">
                
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400 dark:text-surface-600">
                        <i class="pi pi-inbox text-5xl mb-3 opacity-30"></i>
                        <p>Belum ada data produk.</p>
                    </div>
                </template>

                <Column field="name" header="Nama Produk (Menu)" sortable style="width: 40%">
                    <template #body="slotProps">
                        <div class="flex items-center gap-3 py-2">
                            <i class="pi pi-utensils text-2xl text-orange-600 dark:text-orange-400"></i>
                            <div>
                                <div class="font-bold text-base text-surface-800 dark:text-surface-100 leading-tight">{{ slotProps.data.name }}</div>
                                <div class="text-xs text-surface-500 dark:text-surface-400">{{ slotProps.data.categories.join(', ') || 'Non-Kategori' }}</div>
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column header="Status Resep" style="width: 30%">
                    <template #body="slotProps">
                        <Tag v-if="slotProps.data.hasRecipe" value="Lengkap" severity="success" class="text-xs" />
                        <Tag v-else value="Belum Ada" severity="warning" class="text-xs" />
                    </template>
                </Column>

                <Column header="" style="width: 30%" class="text-right">
                    <template #body="slotProps">
                        <Button 
                            :label="slotProps.data.hasRecipe ? 'Edit Resep' : 'Buat Resep'" 
                            icon="pi pi-flask" 
                            severity="primary" 
                            text 
                            @click="emit('edit', slotProps.data)" 
                        />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>