<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    productData: { type: Object, default: null } // Product data for which recipe is being set
});

const emit = defineEmits(['update:visible', 'saved']);

const productService = useProductService(); // For fetching ingredient products
const recipeService = useRecipeService(); 
const toast = useToast();

const loading = ref(false);
const formLoading = ref(false);
const allProducts = ref([]);
const ingredientOptions = computed(() => {
    // Filter produk yang sama (Produk jadi tidak bisa jadi bahan baku dirinya sendiri)
    return allProducts.value
        .filter(p => p.uuid !== props.productData?.uuid)
        .map(p => ({
            label: p.name,
            value: p.uuid,
            units: p.units || []
        }));
});

// State formulir resep
const recipe = reactive({
    ingredients: [], // [{ ingredientProductUuid, unitUuid, qty }]
});

// --- ACTIONS ---

const fetchIngredientOptions = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        allProducts.value = data || [];
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
}

const loadRecipe = async (productUuid) => {
    loading.value = true;
    try {
        const data = await recipeService.getRecipeByProduct(productUuid);
        if (data && data.ingredients) {
             recipe.ingredients = data.ingredients.map(i => ({
                ingredientProductUuid: i.ingredientProductUuid,
                unitUuid: i.unitUuid,
                qty: Number(i.qty)
             }));
        } else {
             recipe.ingredients = [];
        }
    } catch (e) {
        recipe.ingredients = [];
        toast.add({ severity: 'info', summary: 'Info', detail: 'Belum ada resep, silakan tambahkan.', life: 3000 });
    } finally {
        loading.value = false;
    }
}

const addIngredient = () => {
    recipe.ingredients.push({ ingredientProductUuid: null, unitUuid: null, qty: 1 });
};

const removeIngredient = (index) => {
    recipe.ingredients.splice(index, 1);
};

const saveRecipe = async () => {
    if (!props.productData?.uuid) return;
    
    // Validasi Dasar
    const valid = recipe.ingredients.every(i => i.ingredientProductUuid && i.unitUuid && i.qty > 0);
    if (!valid) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pastikan semua bahan baku, satuan, dan Qty terisi dengan benar.', life: 3000 });
        return;
    }

    formLoading.value = true;
    try {
        await recipeService.saveRecipe(props.productData.uuid, { ingredients: recipe.ingredients });
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: `Resep untuk ${props.productData.name} berhasil disimpan!`, life: 3000 });
        emit('saved');
        closeDialog();
    } catch (e) {
        const msg = e.response?._data?.message || 'Gagal menyimpan resep.';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

const closeDialog = () => emit('update:visible', false);

// --- WATCHERS & ON MOUNTED ---
watch(() => props.visible, async (val) => {
    if (val && props.productData) {
        await fetchIngredientOptions();
        await loadRecipe(props.productData.uuid);
    }
});

</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="`Resep: ${productData?.name || 'Loading...'}`" 
        :modal="true" 
        :style="{ width: '800px' }" 
        maximizable
        class="p-fluid"
    >
        <div v-if="loading" class="text-center py-10">
            <ProgressSpinner />
        </div>
        
        <div v-else class="space-y-4">
            <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
                <p class="text-sm font-semibold text-surface-700 dark:text-surface-200">Definisi: 1 Unit Produk Jadi ({{ productData?.units.find(u => u.uuid === productData.defaultUnitUuid)?.unitName || 'PCS' }}) terdiri dari...</p>
            </div>

            <div class="flex justify-between items-center mb-4">
                <h3 class="text-base font-bold text-surface-700 dark:text-surface-200">Daftar Bahan Baku (Ingredients)</h3>
                <Button label="Tambah Bahan" icon="pi pi-plus" size="small" text @click="addIngredient" />
            </div>

            <div class="space-y-3">
                <div v-if="!recipe.ingredients.length" class="text-center py-6 text-surface-400 italic">
                    Belum ada bahan baku terdaftar.
                </div>

                <div v-for="(ingredient, index) in recipe.ingredients" :key="index" class="p-3 border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-900 flex flex-col md:flex-row gap-3 items-center">
                    
                    <div class="flex-1">
                        <label class="text-[10px] font-bold text-surface-500 block mb-1">Bahan Baku</label>
                        <Dropdown 
                            v-model="ingredient.ingredientProductUuid" 
                            :options="ingredientOptions" 
                            optionLabel="label" 
                            optionValue="value" 
                            placeholder="Pilih Produk Bahan Baku" 
                            filter
                            class="w-full !h-10 text-sm"
                            @change="ingredient.unitUuid = null"
                        />
                    </div>

                    <div class="w-full md:w-32">
                        <label class="text-[10px] font-bold text-surface-500 block mb-1">Satuan</label>
                        <Dropdown 
                            v-model="ingredient.unitUuid" 
                            :options="ingredientOptions.find(o => o.value === ingredient.ingredientProductUuid)?.units || []" 
                            optionLabel="unitName" 
                            optionValue="uuid" 
                            placeholder="Unit" 
                            class="w-full !h-10 text-sm"
                            :disabled="!ingredient.ingredientProductUuid"
                        />
                    </div>

                    <div class="w-full md:w-28">
                        <label class="text-[10px] font-bold text-surface-500 block mb-1">Qty Konsumsi</label>
                        <InputNumber 
                            v-model="ingredient.qty" 
                            :min="0.01" 
                            :step="1"
                            inputClass="!text-sm !text-center !h-10"
                            class="w-full"
                        />
                    </div>

                    <div class="shrink-0 pt-4 md:pt-0">
                        <Button icon="pi pi-trash" severity="danger" text rounded @click="removeIngredient(index)" />
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Batal" icon="pi pi-times" text @click="closeDialog" severity="secondary" />
            <Button label="Simpan Resep" icon="pi pi-check" @click="saveRecipe" :loading="formLoading" :disabled="!recipe.ingredients.length" />
        </template>
    </Dialog>
</template>