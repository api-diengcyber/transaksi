<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    initialSource: Object // Produk yang di-klik dari tabel utama
});
const emit = defineEmits(['update:visible', 'success']);

const toast = useToast();
const journalService = useJournalService();
const productService = useProductService();

const loading = ref(false);
const products = ref([]); 

const form = reactive({
    mode: 'break', // 'break' (Pecah) atau 'combine' (Gabung)
    sourceProductUuid: null,
    sourceVariant: null,
    targetProductUuid: null,
    targetVariant: null,
    qtyAction: 1,  // Menggantikan qtyBreak agar lebih netral
    conversion: 12
});

const modeOptions = [
    { label: 'Pecah Stok (Besar ➔ Kecil)', value: 'break' },
    { label: 'Gabung Stok (Kecil ➔ Besar)', value: 'combine' }
];

// --- LOAD DATA PRODUK ---
const loadProducts = async () => {
    loading.value = true;
    try {
        const res = await productService.getAllProducts(1, 1000);
        products.value = res?.data?.data || res?.data || [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat master produk' });
    } finally {
        loading.value = false;
    }
};

// Auto-fill saat modal dibuka
watch(() => props.visible, (val) => {
    if (val) {
        loadProducts();
        form.mode = 'break';
        form.targetProductUuid = null;
        form.targetVariant = null;
        form.qtyAction = 1;
        form.conversion = 1;
        
        if (props.initialSource) {
            form.sourceProductUuid = props.initialSource.uuid;
            form.sourceVariant = null;
        } else {
            form.sourceProductUuid = null;
        }
    }
});

// Resets formulir bawah jika mode berubah untuk mencegah kebingungan
watch(() => form.mode, () => {
    form.qtyAction = 1;
    form.conversion = 1;
});

// --- COMPUTED DATA & VALIDASI ---
const sourceProductData = computed(() => products.value.find(p => p.uuid === form.sourceProductUuid));
const targetProductData = computed(() => products.value.find(p => p.uuid === form.targetProductUuid));

const sourceUnitName = computed(() => sourceProductData.value?.unit?.name || '-');
const targetUnitName = computed(() => targetProductData.value?.unit?.name || '-');

const isUnitSame = computed(() => {
    if (!sourceProductData.value || !targetProductData.value) return false;
    const sourceUnitUuid = sourceProductData.value.unitUuid || sourceProductData.value.unit?.uuid;
    const targetUnitUuid = targetProductData.value.unitUuid || targetProductData.value.unit?.uuid;
    return sourceUnitUuid === targetUnitUuid && sourceUnitUuid != null;
});

const isSubmitDisabled = computed(() => {
    return !form.sourceProductUuid || 
           !form.targetProductUuid || 
           form.qtyAction < 1 || 
           form.conversion < 1 || 
           isUnitSame.value;
});

// Teks dinamis menyesuaikan mode
const sourceLabel = computed(() => form.mode === 'break' ? 'Pecah Dari (Sumber Besar)' : 'Gabung Dari (Sumber Eceran)');
const targetLabel = computed(() => form.mode === 'break' ? 'Menjadi (Tujuan Eceran)' : 'Menjadi (Tujuan Besar)');

// --- SUBMIT ---
const submitBreakOrCombine = async () => {
    if (isSubmitDisabled.value) return;

    loading.value = true;
    try {
        // Menggunakan endpoint yang berbeda atau pass 'type' ke backend
        const payload = {
            type: form.mode, // 'break' atau 'combine'
            sourceProductUuid: form.sourceProductUuid,
            sourceVariantUuid: form.sourceVariant?.uuid,
            targetProductUuid: form.targetProductUuid,
            targetVariantUuid: form.targetVariant?.uuid,
            qtyAction: form.qtyAction,     // Qty utama yang diproses
            conversionVal: form.conversion // Multiplier
        };

        if (form.mode === 'break') {
            await journalService.breakStock(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Stok berhasil dipecah.' });
        } else {
            await journalService.combineStock(payload); // Pastikan endpoint ini ada di backend/service
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Stok berhasil digabung.' });
        }
        
        emit('success');
        emit('update:visible', false);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.response?._data?.message || e.message });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        header="Konversi Stok" 
        :modal="true" 
        class="w-full max-w-2xl"
        :pt="{ root: { class: '!rounded-2xl' }, header: { class: '!border-b !border-surface-200 !bg-surface-50' } }"
    >
        <div class="flex flex-col gap-5 py-4">
            
            <div class="flex justify-center mb-2">
                <SelectButton v-model="form.mode" :options="modeOptions" optionLabel="label" optionValue="value" class="!text-sm shadow-sm" />
            </div>

            <Message v-if="isUnitSame" severity="error" :closable="false" class="!m-0">
                <span class="font-bold">Satuan Tidak Valid:</span> Produk sumber dan tujuan memiliki satuan yang sama (<b>{{ sourceUnitName }}</b>). Konversi hanya bisa dilakukan antar satuan yang berbeda.
            </Message>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                
                <div class="bg-white border-2 border-orange-200 rounded-xl p-4 shadow-sm relative overflow-hidden transition-colors" :class="form.mode === 'combine' ? 'border-blue-200' : ''">
                    <div class="absolute top-0 left-0 w-full h-1" :class="form.mode === 'combine' ? 'bg-blue-500' : 'bg-orange-500'"></div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-6 h-6 rounded flex items-center justify-center" :class="form.mode === 'combine' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'">
                            <i :class="form.mode === 'combine' ? 'pi pi-th-large' : 'pi pi-box'" class="text-xs"></i>
                        </div>
                        <label class="text-xs font-black uppercase tracking-wider" :class="form.mode === 'combine' ? 'text-blue-800' : 'text-orange-800'">
                            {{ sourceLabel }}
                        </label>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <Dropdown v-model="form.sourceProductUuid" :options="products" optionLabel="name" optionValue="uuid" filter :placeholder="form.mode === 'break' ? 'Cari Produk Besar (Dus)...' : 'Cari Produk Eceran (Pcs)...'" class="w-full" />
                        </div>
                        
                        <div v-if="sourceProductData" class="flex justify-between items-center bg-surface-50 p-2 rounded border border-surface-200">
                            <span class="text-[10px] text-surface-500 uppercase font-bold">Satuan:</span>
                            <Tag :value="sourceUnitName" :severity="form.mode === 'combine' ? 'info' : 'warning'" class="!text-[10px]" />
                        </div>

                        <div v-if="sourceProductData?.variants?.length > 0" class="animate-fade-in pt-2 border-t border-surface-100">
                            <label class="text-[10px] mb-1 block font-bold text-surface-600 uppercase">Varian Sumber (Opsional)</label>
                            <Dropdown v-model="form.sourceVariant" :options="sourceProductData.variants" optionLabel="name" placeholder="Pilih Varian" class="w-full p-dropdown-sm" showClear />
                        </div>
                    </div>
                </div>

                <div class="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-surface-200 rounded-full items-center justify-center shadow-md transition-transform" :class="form.mode === 'combine' ? 'rotate-0' : ''">
                    <i class="pi pi-arrow-right text-surface-400"></i>
                </div>

                <div class="bg-white border-2 rounded-xl p-4 shadow-sm relative overflow-hidden" :class="[{'opacity-50 pointer-events-none': !form.sourceProductUuid}, form.mode === 'combine' ? 'border-orange-200' : 'border-emerald-200']">
                    <div class="absolute top-0 left-0 w-full h-1" :class="form.mode === 'combine' ? 'bg-orange-500' : 'bg-emerald-500'"></div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-6 h-6 rounded flex items-center justify-center" :class="form.mode === 'combine' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'">
                            <i :class="form.mode === 'combine' ? 'pi pi-box' : 'pi pi-th-large'" class="text-xs"></i>
                        </div>
                        <label class="text-xs font-black uppercase tracking-wider" :class="form.mode === 'combine' ? 'text-orange-800' : 'text-emerald-800'">
                            {{ targetLabel }}
                        </label>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <Dropdown v-model="form.targetProductUuid" :options="products" optionLabel="name" optionValue="uuid" filter :placeholder="form.mode === 'break' ? 'Cari Produk Eceran (Pcs)...' : 'Cari Produk Besar (Dus)...'" class="w-full" />
                        </div>

                        <div v-if="targetProductData" class="flex justify-between items-center bg-surface-50 p-2 rounded border border-surface-200">
                            <span class="text-[10px] text-surface-500 uppercase font-bold">Satuan:</span>
                            <Tag :value="targetUnitName" :severity="form.mode === 'combine' ? 'warning' : 'success'" class="!text-[10px]" />
                        </div>

                        <div v-if="targetProductData?.variants?.length > 0" class="animate-fade-in pt-2 border-t border-surface-100">
                            <label class="text-[10px] mb-1 block font-bold text-surface-600 uppercase">Varian Tujuan (Opsional)</label>
                            <Dropdown v-model="form.targetVariant" :options="targetProductData.variants" optionLabel="name" placeholder="Pilih Varian" class="w-full p-dropdown-sm" showClear />
                        </div>
                    </div>
                </div>

            </div>

            <div class="bg-surface-100 p-4 rounded-xl border border-surface-200 mt-2" :class="{'opacity-50 pointer-events-none': !form.targetProductUuid || isUnitSame}">
                <label class="text-xs font-bold text-surface-800 block mb-3 uppercase tracking-wide">Pengaturan Kalkulasi Stok</label>
                
                <div class="flex flex-col sm:flex-row items-center gap-3">
                    <div class="w-full">
                        <label class="text-[10px] font-semibold text-surface-500 block mb-1">
                            {{ form.mode === 'break' ? `Jumlah ${sourceUnitName} yang dipecah` : `Jumlah ${targetUnitName} yang ingin dibuat` }}
                        </label>
                        <InputGroup>
                            <InputNumber v-model="form.qtyAction" :min="1" placeholder="0" class="w-full font-bold" />
                            <InputGroupAddon class="!bg-white !text-xs font-bold">
                                {{ form.mode === 'break' ? sourceUnitName : targetUnitName }}
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                    
                    <div class="text-surface-400 font-bold mt-4">
                        <i v-if="form.mode === 'break'" class="pi pi-times"></i>
                        <i v-else class="pi pi-percentage px-2"></i> </div>

                    <div class="w-full">
                        <label class="text-[10px] font-semibold text-surface-500 block mb-1">
                            {{ form.mode === 'break' ? `Isi per 1 ${sourceUnitName}` : `Butuh berapa ${sourceUnitName} untuk 1 ${targetUnitName}?` }}
                        </label>
                        <InputGroup>
                            <InputNumber v-model="form.conversion" :min="1" placeholder="0" class="w-full font-bold" />
                            <InputGroupAddon class="!bg-white !text-xs font-bold">
                                {{ form.mode === 'break' ? targetUnitName : sourceUnitName }}
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                </div>
            </div>

            <div v-if="form.targetProductUuid && !isUnitSame" class="bg-surface-900 px-5 py-4 rounded-xl text-white flex flex-col sm:flex-row justify-between items-center shadow-lg gap-2 animate-fade-in">
                
                <div v-if="form.mode === 'break'" class="flex w-full justify-between items-center">
                    <div class="text-sm text-surface-300">Stok <b class="text-white">{{ targetProductData?.name }}</b> bertambah:</div>
                    <div class="text-2xl font-black text-emerald-400 flex items-center gap-2">
                        <i class="pi pi-plus-circle text-lg"></i> {{ form.qtyAction * form.conversion }} <span class="text-sm font-normal text-surface-400">{{ targetUnitName }}</span>
                    </div>
                </div>

                <div v-else class="flex w-full flex-col">
                    <div class="flex justify-between items-center border-b border-surface-700 pb-2 mb-2">
                        <div class="text-sm text-surface-300">Stok <b class="text-white">{{ sourceProductData?.name }}</b> berkurang:</div>
                        <div class="text-lg font-bold text-red-400">- {{ form.qtyAction * form.conversion }} <span class="text-xs text-surface-400">{{ sourceUnitName }}</span></div>
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-surface-300">Stok <b class="text-white">{{ targetProductData?.name }}</b> bertambah:</div>
                        <div class="text-xl font-black text-emerald-400">+ {{ form.qtyAction }} <span class="text-xs text-surface-400">{{ targetUnitName }}</span></div>
                    </div>
                </div>

            </div>

        </div>

        <template #footer>
            <div class="w-full flex justify-end gap-2 pt-2">
                <Button label="Batal" text severity="secondary" @click="emit('update:visible', false)" class="!font-bold" />
                <Button :label="form.mode === 'break' ? 'Proses Pecah Stok' : 'Proses Gabung Stok'" :icon="form.mode === 'break' ? 'pi pi-sitemap' : 'pi pi-box'" @click="submitBreakOrCombine" :loading="loading" :disabled="isSubmitDisabled" class="!font-bold !px-6" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>