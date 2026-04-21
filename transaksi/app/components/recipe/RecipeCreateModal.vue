<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    isOpen: { type: Boolean, default: false },
    productData: { type: Object, default: null } 
});

const emit = defineEmits(['close', 'refresh']);

const productService = useProductService();
const recipeService = useRecipeService(); 
const toast = useToast();

const loading = ref(false);
const formLoading = ref(false);
const allProducts = ref([]);

// Filter Ingredient Options
const ingredientOptions = computed(() => {
    return allProducts.value
        .filter(p => p.uuid !== props.productData?.uuid)
        .map(p => ({
            label: p.name,
            value: p.uuid,
            code: p.productCode || p.barcode,
            // Simpan data unit bawaan produk untuk auto-fill unitUuid nanti
            defaultUnitUuid: p.unitUuid || (p.units && p.units.length > 0 ? p.units[0].uuid : null),
            defaultUnitName: p.unit?.unitName || (p.units && p.units.length > 0 ? p.units[0].unitName : 'PCS')
        }));
});

const recipe = reactive({
    ingredients: [], // Array dari { ingredientProductUuid, unitUuid, qty }
});

// --- ACTIONS ---
const fetchIngredientOptions = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        allProducts.value = data.data || data || [];
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat daftar produk', life: 3000 });
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

// [UPDATE] Fungsi ini dipanggil setiap kali Dropdown Bahan Baku berubah nilainya
const onIngredientChange = (ingredientItem) => {
    const selectedProduct = ingredientOptions.value.find(o => o.value === ingredientItem.ingredientProductUuid);
    if (selectedProduct) {
        // Otomatis isi unitUuid di belakang layar
        ingredientItem.unitUuid = selectedProduct.defaultUnitUuid;
    } else {
        ingredientItem.unitUuid = null;
    }
};

const saveRecipe = async () => {
    // 1. Perbaikan Validasi: Cek UUID dari props ATAU dari dropdown lokal
    const targetProductUuid = props.productData?.uuid || localSelectedProduct.value;

    if (!targetProductUuid) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Produk/Menu tujuan belum dipilih.', life: 3000 });
        return;
    }
    
    // 2. Validasi isian kosong
    const valid = recipe.ingredients.every(i => i.ingredientProductUuid && i.unitUuid && i.qty > 0);
    if (!valid) {
        toast.add({ severity: 'warn', summary: 'Validasi Gagal', detail: 'Pastikan bahan baku dipilih dan Kuantitas diisi.', life: 4000 });
        return;
    }

    formLoading.value = true;
    try {
        // 3. Gunakan targetProductUuid untuk melakukan proses penyimpanan
        await recipeService.saveRecipe(targetProductUuid, { ingredients: recipe.ingredients });
        
        const productName = props.productData?.name || allProducts.value.find(p => p.uuid === targetProductUuid)?.name || 'Menu';
        toast.add({ severity: 'success', summary: 'Sukses', detail: `Resep untuk ${productName} berhasil disimpan!`, life: 3000 });
        
        emit('refresh'); 
        closeDialog();
    } catch (e) {
        console.error(e);
        const msg = e.response?._data?.message || 'Terjadi kesalahan saat menyimpan resep.';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

const closeDialog = () => emit('close');

// --- WATCHERS ---
watch(() => props.isOpen, async (newVal) => {
    if (newVal) {
        await fetchIngredientOptions();
        if (props.productData?.uuid) {
            await loadRecipe(props.productData.uuid);
        } else {
            recipe.ingredients = [];
        }
    }
});

const localSelectedProduct = ref(null);
watch(localSelectedProduct, async (newUuid) => {
    if (newUuid) {
         await loadRecipe(newUuid);
    }
});
</script>

<template>
    <Dialog 
        :visible="isOpen" 
        @update:visible="closeDialog" 
        :header="productData ? `Edit Resep: ${productData.name}` : 'Buat Resep Baru (BOM)'" 
        :modal="true" 
        :style="{ width: '700px' }" 
        class="custom-dialog p-fluid" 
        :pt="{ 
            content: { class: 'bg-slate-50/50' },
            header: { class: 'bg-slate-50 border-b border-slate-200' }
        }"
    >
        
        <div v-if="loading" class="flex flex-col items-center justify-center py-16">
            <i class="pi pi-spin pi-spinner text-4xl text-orange-500 mb-4"></i>
            <span class="text-slate-500 text-sm font-medium animate-pulse">Memuat Data Resep...</span>
        </div>
        
        <div v-else class="space-y-6 pt-4 pb-2">
            
            <div v-if="!productData" class="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                    <i class="pi pi-box mr-1"></i> Pilih Produk/Menu Jadi
                </label>
                <Dropdown 
                    v-model="localSelectedProduct" 
                    :options="allProducts" 
                    optionLabel="name" 
                    optionValue="uuid" 
                    placeholder="Ketik & Pilih Menu/Produk Jadi..." 
                    filter
                    class="w-full shadow-sm !border-slate-200"
                >
                    <template #value="slotProps">
                        <div v-if="slotProps.value" class="flex items-center gap-2">
                            <span class="font-bold">{{ allProducts.find(p => p.uuid === slotProps.value)?.name }}</span>
                        </div>
                        <span v-else class="text-slate-400">{{ slotProps.placeholder }}</span>
                    </template>
                </Dropdown>
            </div>

            <div v-else class="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white shadow-sm">
                <div class="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <i class="pi pi-receipt text-2xl"></i>
                </div>
                <div>
                    <h3 class="font-bold text-base">Definisi Racikan (Bill of Materials)</h3>
                    <p class="text-xs text-orange-100 mt-0.5">
                        Resep ini akan digunakan setiap kali 1 Porsi/Unit <strong class="text-white">{{ productData.name }}</strong> diproduksi.
                    </p>
                </div>
            </div>

            <div class="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm relative">
                <div class="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                    <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wide">
                        Bahan Baku Penyusun
                    </h3>
                    <button 
                        @click="addIngredient"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-600 hover:text-white rounded-lg transition-all"
                    >
                        <i class="pi pi-plus-circle"></i> Tambah Bahan
                    </button>
                </div>

                <div class="space-y-3">
                    <div v-if="!recipe.ingredients.length" class="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <i class="pi pi-box text-3xl text-slate-300 mb-2 block"></i>
                        <span class="text-sm text-slate-500 font-medium">Belum ada bahan baku ditambahkan.</span>
                    </div>

                    <div v-for="(ingredient, index) in recipe.ingredients" :key="index" 
                         class="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col md:flex-row gap-3 md:gap-4 items-start md:items-center group hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                        
                        <div class="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-xs font-bold shrink-0 mt-6 md:mt-0">
                            {{ index + 1 }}
                        </div>

                        <div class="flex-1 w-full relative">
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Bahan Baku</label>
                            <Dropdown 
                                v-model="ingredient.ingredientProductUuid" 
                                :options="ingredientOptions" 
                                optionLabel="label" 
                                optionValue="value" 
                                placeholder="Cari Produk..." 
                                filter
                                class="w-full !border-slate-200 bg-white"
                                @change="() => onIngredientChange(ingredient)"
                            >
                                <template #option="slotProps">
                                    <div class="flex items-center justify-between w-full">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-medium leading-tight">{{ slotProps.option.label }}</span>
                                            <span class="text-[10px] text-slate-400 mt-0.5">Satuan: {{ slotProps.option.defaultUnitName }}</span>
                                        </div>
                                        <span class="text-xs font-mono text-slate-400">{{ slotProps.option.code }}</span>
                                    </div>
                                </template>
                            </Dropdown>

                            <div v-if="ingredient.ingredientProductUuid" class="absolute -bottom-4 left-1 text-[10px] text-slate-400 font-medium italic">
                                Satuan: {{ ingredientOptions.find(o => o.value === ingredient.ingredientProductUuid)?.defaultUnitName || '?' }}
                            </div>
                        </div>

                        <div class="w-full md:w-36">
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Kuantitas Pemakaian</label>
                            <InputNumber 
                                v-model="ingredient.qty" 
                                :min="0.0001" 
                                mode="decimal"
                                :minFractionDigits="0"
                                :maxFractionDigits="4"
                                inputClass="!text-sm !font-mono !text-center bg-white"
                                class="w-full"
                            />
                        </div>

                        <div class="shrink-0 self-end md:self-center md:pt-4">
                            <button 
                                @click="removeIngredient(index)" 
                                class="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Hapus Bahan"
                            >
                                <i class="pi pi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>

        <template #footer>
            <div class="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-2">
                <Button label="Tutup" icon="pi pi-times" text class="!text-slate-500 hover:!bg-slate-100" @click="closeDialog" />
                <Button 
                    label="Simpan Racikan" 
                    icon="pi pi-check" 
                    class="bg-orange-600 hover:bg-orange-700 border-none px-6 shadow-sm shadow-orange-600/20" 
                    @click="saveRecipe" 
                    :loading="formLoading" 
                    :disabled="(!productData && !localSelectedProduct) || !recipe.ingredients.length" 
                />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
:deep(.p-dropdown),
:deep(.p-inputnumber .p-inputtext) {
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

:deep(.p-dropdown:focus-within),
:deep(.p-inputtext:focus) {
    border-color: #f97316 !important; 
    box-shadow: 0 0 0 1px #f97316 !important;
}

:deep(.p-dropdown-panel) {
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}
</style>