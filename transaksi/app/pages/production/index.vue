<script setup>
import { ref, reactive, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'default' });

const productService = useProductService();
const productionService = useProductionService(); // Asumsi service sudah dibuat
const toast = useToast();

const loading = ref(true);
const processing = ref(false);
const products = ref([]);
const cart = ref([]);
const searchQuery = ref('');

const form = reactive({
    employeeName: '',
    notes: '',
});

const canSubmit = computed(() => {
    return cart.value.length > 0 && !!form.employeeName && !processing.value;
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

// --- ACTIONS ---

const loadProducts = async () => {
    loading.value = true;
    try {
        // Ambil semua produk yang BUKAN bahan baku (misal: isRestaurant=false, atau filter kategori Bahan)
        const data = await productService.getAllProducts();
        
        // Filter: Hanya tampilkan produk jadi (asumsi: bukan kategori 'Bahan' atau produk yang punya resep)
        products.value = (data || []).filter(p => 
            !(p.productCategory || []).some(pc => pc.category?.name === 'Bahan')
        );
        
        filteredProducts.value = products.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat produk', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const handleSearch = () => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) {
        filteredProducts.value = products.value;
        return;
    }
    
    filteredProducts.value = products.value.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.units.some(u => u.barcode?.includes(query))
    );
};

const addToCart = (product) => {
    const selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    if (!selectedUnit) {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk error (tanpa satuan)', life: 3000 });
        return;
    }

    const existingItem = cart.value.find(item => item.productUuid === product.uuid && item.unitUuid === selectedUnit.uuid);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.value.push({
            productUuid: product.uuid,
            name: product.name,
            unitUuid: selectedUnit.uuid,
            unitName: selectedUnit.unitName,
            qty: 1,
            availableUnits: product.units
        });
    }
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const getDefaultUnitName = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.unitName;
};

const handleSubmitSetoran = async () => {
    if (!canSubmit.value) return;

    processing.value = true;
    try {
        const payloadDetails = {
            employee_name: form.employeeName,
            notes: form.notes,
            total_items_count: cart.value.length,
        };

        cart.value.forEach((item, index) => {
            payloadDetails[`product_uuid#${index}`] = item.productUuid;
            payloadDetails[`unit_uuid#${index}`] = item.unitUuid;
            // Gunakan key 'stok_plus' untuk mencatat penambahan stok
            payloadDetails[`stok_plus#${item.productUuid}_${item.unitUuid}`] = item.qty; 
            payloadDetails[`qty#${index}`] = item.qty; 
        });

        // Kirim payload sesuai format JournalController
        await productionService.submitSetoran(payloadDetails);

        toast.add({ severity: 'success', summary: 'Setoran Sukses', detail: `Setoran dari ${form.employeeName} berhasil dicatat.`, life: 5000 });
        
        // Reset state
        cart.value = [];
        form.employeeName = '';
        form.notes = '';
        loadProducts(); // Refresh data produk
        
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan saat memproses setoran', life: 3000 });
    } finally {
        processing.value = false;
    }
};


onMounted(() => {
    loadProducts();
});

</script>

<template>
    <div class="h-[calc(100vh-5rem)]">
        <Toast />

        <div class="flex items-center justify-between mb-4">
             <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Setoran Hasil Produksi</h1>
        </div>

        <div class="flex flex-col lg:flex-row h-[calc(100%-4rem)] gap-4">

            <div class="flex-1 flex flex-col dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
                <div class="p-3 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-950/50">
                    <div class="relative flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 text-sm"></i>
                        <input 
                            v-model="searchQuery" 
                            type="text"
                            placeholder="Cari Produk Hasil Produksi..." 
                            class="w-full pl-9 pr-3 py-2 text-sm dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all shadow-sm h-10"
                            @input="handleSearch"
                            autocomplete="off"
                        />
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-3 bg-surface-50 dark:bg-surface-950 scrollbar-thin">
                    <div v-if="loading" class="flex justify-center py-20">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                    </div>

                    <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                        <div v-for="prod in filteredProducts" :key="prod.uuid"
                            @click="addToCart(prod)"
                            class="group relative dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all active:scale-95 select-none flex flex-col justify-between h-28"
                        >
                            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <i class="pi pi-plus-circle text-primary-500 text-lg rounded-full"></i>
                            </div>
                            
                            <div>
                                <div class="text-xs font-bold text-surface-700 dark:text-surface-200 line-clamp-2 mb-1 leading-snug group-hover:text-primary-600 transition-colors">
                                    {{ prod.name }}
                                </div>
                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-600">
                                    Satuan: {{ getDefaultUnitName(prod) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div v-else class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-600 gap-2 opacity-60">
                        <i class="pi pi-box text-4xl"></i>
                        <span class="text-xs">Produk hasil produksi tidak ditemukan</span>
                    </div>
                </div>
            </div>
            
            <div class="w-full lg:w-[450px] flex flex-col dark:bg-surface-900 rounded-xl shadow-lg border border-surface-200 dark:border-surface-800 shrink-0">
                
                <div class="p-4 border-b border-surface-200 dark:border-surface-700">
                    <h2 class="font-bold text-sm text-primary-600 flex items-center gap-2 mb-3">
                         <i class="pi pi-user text-lg"></i> Data Pegawai & Catatan
                    </h2>
                    <div class="space-y-3">
                        <div class="field">
                            <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Nama Pegawai <span class="text-red-500">*</span></label>
                            <InputText v-model="form.employeeName" placeholder="Contoh: Ujang" class="w-full !py-2.5 !text-sm" />
                        </div>
                        <div class="field">
                            <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Catatan</label>
                            <Textarea v-model="form.notes" rows="2" placeholder="Keterangan tambahan..." class="w-full !text-xs resize-none" />
                        </div>
                    </div>
                </div>

                <div class="flex-1 flex flex-col overflow-hidden">
                    <div class="p-3 px-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                                <span class="font-bold text-xs">{{ totalItems }}</span>
                            </div>
                            <span class="font-bold text-sm text-surface-700">Produk Disetor</span>
                        </div>
                        <Button 
                            v-if="cart.length > 0" 
                            icon="pi pi-trash" 
                            text 
                            rounded
                            severity="danger" 
                            size="small" 
                            class="!w-8 !h-8" 
                            v-tooltip.bottom="'Kosongkan'"
                            @click="cart = []" 
                        />
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30">
                        <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 gap-2 opacity-60">
                            <i class="pi pi-inbox text-4xl mb-1"></i>
                            <p class="text-xs font-medium">Pilih produk hasil produksi</p>
                        </div>

                        <div v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" 
                            class="dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 transition-all group relative">
                            
                            <button class="absolute -top-2 -right-2 w-6 h-6 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-full shadow-sm flex items-center justify-center text-surface-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 z-10 transform scale-90 group-hover:scale-100" 
                                    @click="removeFromCart(index)">
                                <i class="pi pi-times text-[10px] font-bold"></i>
                            </button>

                            <div class="mb-3 pr-4">
                                <div class="font-bold text-xs text-surface-800 dark:text-surface-100 leading-relaxed">
                                    {{ item.name }}
                                </div>
                            </div>

                            <div class="flex items-end gap-3">
                                <div class="flex-1 flex flex-col gap-2">
                                    <div class="inline-flex items-center h-7 bg-surface-100 dark:bg-surface-900 rounded-lg px-2 border border-surface-200 dark:border-surface-700 w-fit">
                                        <span class="text-[9px] text-surface-400 font-bold uppercase mr-2 tracking-wide">Satuan</span>
                                        <span class="text-xs font-bold text-surface-700 dark:text-surface-200">{{ item.unitName }}</span>
                                    </div>
                                </div>

                                <div class="flex flex-col items-end justify-between h-full gap-2">
                                    <div class="flex items-center bg-surface-100 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 h-8 shadow-sm">
                                        <button class="w-8 h-full flex items-center justify-center text-surface-500 hover:text-red-500 rounded-l-lg transition-colors" 
                                                @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                            <i class="pi pi-minus text-[9px] font-bold"></i>
                                        </button>
                                        <input v-model="item.qty" type="number" class="w-10 h-full bg-transparent text-center text-sm font-bold border-none outline-none appearance-none m-0 p-0 text-surface-800" min="1" />
                                        <button class="w-8 h-full flex items-center justify-center text-surface-500 hover:text-primary-600 rounded-r-lg transition-colors" 
                                                @click="item.qty++">
                                            <i class="pi pi-plus text-[9px] font-bold"></i>
                                        </button>
                                    </div>

                                    <span class="text-[10px] font-bold text-surface-500">
                                        Total: {{ item.qty }} {{ item.unitName }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-surface-150 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 shrink-0">
                    <Button 
                        label="SELESAI & SETOR PRODUKSI" 
                        icon="pi pi-check-circle" 
                        iconPos="right"
                        class="w-full font-bold !py-3 !text-sm !bg-primary-600 hover:!bg-primary-700 !border-none !text-white shadow-lg shadow-primary-900/30 active:translate-y-0.5 transition-all !rounded-xl" 
                        :disabled="!canSubmit" 
                        :loading="processing" 
                        @click="handleSubmitSetoran" 
                    />
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>