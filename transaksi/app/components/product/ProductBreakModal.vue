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
    sourceProductUuid: null,
    sourceVariant: null,
    targetProductUuid: null,
    targetVariant: null,
    qtyBreak: 1,
    conversion: 12
});

// --- LOAD DATA PRODUK ---
const loadProducts = async () => {
    loading.value = true;
    try {
        // Tarik semua data produk untuk pilihan di Dropdown
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
        // Reset form
        form.targetProductUuid = null;
        form.targetVariant = null;
        form.qtyBreak = 1;
        form.conversion = 1;
        
        if (props.initialSource) {
            form.sourceProductUuid = props.initialSource.uuid;
            form.sourceVariant = null;
        } else {
            form.sourceProductUuid = null;
        }
    }
});

// --- COMPUTED DATA & VALIDASI ---
const sourceProductData = computed(() => products.value.find(p => p.uuid === form.sourceProductUuid));
const targetProductData = computed(() => products.value.find(p => p.uuid === form.targetProductUuid));

const sourceUnitName = computed(() => sourceProductData.value?.unit?.name || '-');
const targetUnitName = computed(() => targetProductData.value?.unit?.name || '-');

// Mengecek apakah satuan produk sumber dan tujuan sama persis
const isUnitSame = computed(() => {
    if (!sourceProductData.value || !targetProductData.value) return false;
    
    const sourceUnitUuid = sourceProductData.value.unitUuid || sourceProductData.value.unit?.uuid;
    const targetUnitUuid = targetProductData.value.unitUuid || targetProductData.value.unit?.uuid;
    
    return sourceUnitUuid === targetUnitUuid && sourceUnitUuid != null;
});

// Tombol submit mati jika data belum lengkap, atau satuannya sama
const isSubmitDisabled = computed(() => {
    return !form.sourceProductUuid || 
           !form.targetProductUuid || 
           form.qtyBreak < 1 || 
           form.conversion < 1 || 
           isUnitSame.value;
});

// --- SUBMIT ---
const submitBreak = async () => {
    if (isSubmitDisabled.value) return;

    loading.value = true;
    try {
        await journalService.breakStock({
            sourceProductUuid: form.sourceProductUuid,
            sourceVariantUuid: form.sourceVariant?.uuid,
            targetProductUuid: form.targetProductUuid,
            targetVariantUuid: form.targetVariant?.uuid,
            qtyToBreak: form.qtyBreak,
            conversionVal: form.conversion
        });
        
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Stok berhasil dipecah/dikonversi.' });
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
        header="Konversi / Pecah Stok" 
        :modal="true" 
        class="w-full max-w-2xl"
        :pt="{ root: { class: '!rounded-2xl' }, header: { class: '!border-b !border-surface-200 !bg-surface-50' } }"
    >
        <div class="flex flex-col gap-5 py-4">
            
            <Message v-if="isUnitSame" severity="error" :closable="false" class="!m-0">
                <span class="font-bold">Satuan Tidak Valid:</span> Produk sumber dan tujuan memiliki satuan yang sama (<b>{{ sourceUnitName }}</b>). Pecah stok hanya bisa dilakukan antar satuan yang berbeda (Contoh: Dus ke Pcs).
            </Message>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                
                <div class="bg-white border-2 border-orange-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-6 h-6 rounded bg-orange-100 flex items-center justify-center text-orange-600"><i class="pi pi-box text-xs"></i></div>
                        <label class="text-xs font-black text-orange-800 uppercase tracking-wider">Pecah Dari (Sumber)</label>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <Dropdown v-model="form.sourceProductUuid" :options="products" optionLabel="name" optionValue="uuid" filter placeholder="Cari Produk Besar (Mis: Dus)..." class="w-full" />
                        </div>
                        
                        <div v-if="sourceProductData" class="flex justify-between items-center bg-surface-50 p-2 rounded border border-surface-200">
                            <span class="text-[10px] text-surface-500 uppercase font-bold">Satuan:</span>
                            <Tag :value="sourceUnitName" severity="warning" class="!text-[10px]" />
                        </div>

                        <div v-if="sourceProductData?.variants?.length > 0" class="animate-fade-in pt-2 border-t border-surface-100">
                            <label class="text-[10px] mb-1 block font-bold text-surface-600 uppercase">Varian Sumber (Opsional)</label>
                            <Dropdown v-model="form.sourceVariant" :options="sourceProductData.variants" optionLabel="name" placeholder="Pilih Varian" class="w-full p-dropdown-sm" showClear />
                        </div>
                    </div>
                </div>

                <div class="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-surface-200 rounded-full items-center justify-center shadow-md">
                    <i class="pi pi-arrow-right text-surface-400"></i>
                </div>
                <div class="flex md:hidden justify-center -my-3 z-10">
                    <div class="w-8 h-8 bg-white border border-surface-200 rounded-full flex items-center justify-center shadow-sm">
                        <i class="pi pi-arrow-down text-surface-400"></i>
                    </div>
                </div>

                <div class="bg-white border-2 border-emerald-200 rounded-xl p-4 shadow-sm relative overflow-hidden" :class="{'opacity-50 pointer-events-none': !form.sourceProductUuid}">
                    <div class="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-600"><i class="pi pi-th-large text-xs"></i></div>
                        <label class="text-xs font-black text-emerald-800 uppercase tracking-wider">Menjadi (Tujuan)</label>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <Dropdown v-model="form.targetProductUuid" :options="products" optionLabel="name" optionValue="uuid" filter placeholder="Cari Produk Eceran (Mis: Pcs)..." class="w-full" />
                        </div>

                        <div v-if="targetProductData" class="flex justify-between items-center bg-surface-50 p-2 rounded border border-surface-200">
                            <span class="text-[10px] text-surface-500 uppercase font-bold">Satuan:</span>
                            <Tag :value="targetUnitName" severity="success" class="!text-[10px]" />
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
                        <label class="text-[10px] font-semibold text-surface-500 block mb-1">Jumlah {{ sourceUnitName }} yang dipecah</label>
                        <InputGroup>
                            <InputNumber v-model="form.qtyBreak" :min="1" placeholder="0" class="w-full font-bold" />
                            <InputGroupAddon class="!bg-white !text-xs font-bold">{{ sourceUnitName }}</InputGroupAddon>
                        </InputGroup>
                    </div>
                    
                    <div class="text-surface-400 font-bold mt-4"><i class="pi pi-times"></i></div>

                    <div class="w-full">
                        <label class="text-[10px] font-semibold text-surface-500 block mb-1">Isi per 1 {{ sourceUnitName }}</label>
                        <InputGroup>
                            <InputNumber v-model="form.conversion" :min="1" placeholder="0" class="w-full font-bold" />
                            <InputGroupAddon class="!bg-white !text-xs font-bold">{{ targetUnitName }}</InputGroupAddon>
                        </InputGroup>
                    </div>
                </div>
            </div>

            <div v-if="form.targetProductUuid && !isUnitSame" class="bg-surface-900 px-5 py-4 rounded-xl text-white flex flex-col sm:flex-row justify-between items-center shadow-lg gap-2 animate-fade-in">
                <div class="text-sm text-surface-300">
                    Stok <b class="text-white">{{ targetProductData?.name }}</b> bertambah:
                </div>
                <div class="text-2xl font-black text-emerald-400 flex items-center gap-2">
                    <i class="pi pi-plus-circle text-lg"></i>
                    {{ form.qtyBreak * form.conversion }} <span class="text-sm font-normal text-surface-400">{{ targetUnitName }}</span>
                </div>
            </div>

        </div>

        <template #footer>
            <div class="w-full flex justify-end gap-2 pt-2">
                <Button label="Batal" text severity="secondary" @click="emit('update:visible', false)" class="!font-bold" />
                <Button label="Proses Pecah Stok" icon="pi pi-check-circle" @click="submitBreak" :loading="loading" :disabled="isSubmitDisabled" class="!font-bold !px-6" />
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