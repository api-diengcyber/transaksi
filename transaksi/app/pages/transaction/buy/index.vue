<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProductCreateModal from '~/components/ProductCreateModal.vue';

const productService = useProductService();
const journalService = useJournalService();
const toast = useToast();

// --- STATE ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);
const showCreateModal = ref(false);

// State khusus Pembelian
const purchaseInfo = reactive({
    supplier: '',
    referenceNo: '',
    notes: ''
});

// --- COMPUTED ---

const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => {
        return total + (item.buyPrice * item.qty);
    }, 0);
});

const canCheckout = computed(() => {
    return cart.value.length > 0 && grandTotal.value > 0;
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

// --- ACTIONS ---

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') handleSearch();
};

const loadProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        products.value = (data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            stock: p.stock || [],
            units: p.units || []
        }));
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

    const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));

    if (exactProduct) {
        const matchedUnit = exactProduct.units.find(u => u.barcode === query);
        addToCart(exactProduct, matchedUnit);
        
        searchQuery.value = ''; 
        filteredProducts.value = products.value; 
        toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name} ditambahkan`, life: 1500 });
    } else {
        filteredProducts.value = products.value.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.units.some(u => u.barcode?.includes(query))
        );
    }
};

const addToCart = (product, specificUnit = null) => {
    let selectedUnit = specificUnit;
    if (!selectedUnit) {
        selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    }

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
            buyPrice: 0, 
            qty: 1,
            availableUnits: product.units
        });
        
        setTimeout(() => {
            const cartEl = document.getElementById('cart-items-container');
            if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
        }, 50);
    }
};

const changeCartItemUnit = (item, newUnitUuid) => {
    const newUnit = item.availableUnits.find(u => u.uuid === newUnitUuid);
    if (!newUnit) return;
    item.unitUuid = newUnit.uuid;
    item.unitName = newUnit.unitName;
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const onProductCreated = async (newProduct) => {
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) {
        addToCart(fullProduct);
        toast.add({ severity: 'info', summary: 'Info', detail: 'Produk baru masuk list pembelian', life: 3000 });
    }
};

const processPurchase = async () => {
    if (!canCheckout.value) return;

    processing.value = true;
    try {
        const payload = {
            details: {
                grand_total: grandTotal.value,
                supplier: purchaseInfo.supplier || 'Umum',
                reference_no: purchaseInfo.referenceNo || '-',
                notes: purchaseInfo.notes,
                total_items_count: cart.value.length 
            }
        };

        cart.value.forEach((item, index) => {
            payload.details[`product_uuid#${index}`] = item.productUuid;
            payload.details[`unit_uuid#${index}`] = item.unitUuid;
            payload.details[`qty#${index}`] = item.qty;
            payload.details[`buy_price#${index}`] = item.buyPrice;
            payload.details[`subtotal#${index}`] = item.qty * item.buyPrice;
        });

        await journalService.createBuyTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Stok Masuk', detail: 'Data pembelian berhasil disimpan', life: 5000 });
        
        cart.value = [];
        purchaseInfo.supplier = '';
        purchaseInfo.referenceNo = '';
        purchaseInfo.notes = '';
        await loadProducts(); 

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Transaksi gagal diproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-700 border-red-200';
    if (qty < 10) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

onMounted(() => {
    loadProducts();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') document.getElementById('search-input')?.focus();
    });
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-[calc(100vh-5rem)] gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-950 font-sans">
        <Toast />

        <!-- KOLOM 1: KATALOG PRODUK -->
        <div class="flex-1 flex flex-col bg-white dark:bg-surface-900 rounded-2xl shadow border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            <!-- Header -->
            <div class="p-4 border-b border-surface-100 dark:border-surface-800 flex flex-col gap-3 bg-surface-50/30">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2.5 text-orange-600 dark:text-orange-400">
                        <div class="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shadow-sm">
                            <i class="pi pi-download text-lg"></i>
                        </div>
                        <div class="flex flex-col">
                            <h2 class="font-black text-sm uppercase tracking-wide leading-none">Stok Masuk</h2>
                            <span class="text-[10px] text-surface-500 mt-1 font-medium">Pilih produk untuk restock</span>
                        </div>
                    </div>
                    <Button label="Produk Baru" icon="pi pi-plus" size="small" outlined severity="warning" class="!text-[11px] !py-1.5 !px-3 !rounded-lg" @click="showCreateModal = true" />
                </div>
                
                <div class="relative group">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm group-focus-within:text-orange-500 transition-colors"></i>
                    <input 
                        id="search-input"
                        v-model="searchQuery" 
                        type="text"
                        placeholder="Cari nama produk atau scan barcode... (F2)" 
                        class="w-full pl-9 pr-4 py-2.5 text-xs font-medium bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all shadow-sm"
                        @keydown="onSearchKeydown" 
                        @input="handleSearch"
                        autocomplete="off"
                    />
                </div>
            </div>
            
            <!-- Grid Produk -->
            <div class="flex-1 overflow-y-auto p-4 bg-surface-50 dark:bg-surface-950 scrollbar-thin">
                <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 35px; height: 35px" strokeWidth="4" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    <div 
                        v-for="prod in filteredProducts" 
                        :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="group relative bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[110px] select-none"
                    >
                        <!-- Hover indicator -->
                        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="pi pi-plus-circle text-orange-500 text-lg bg-white rounded-full"></i>
                        </div>

                        <div class="flex flex-col h-full justify-between">
                            <div>
                                <div class="font-bold text-xs text-surface-700 dark:text-surface-200 leading-snug line-clamp-2 mb-2 group-hover:text-orange-700 transition-colors">
                                    {{ prod.name }}
                                </div>
                            </div>
                            
                            <div class="flex items-end justify-between">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[10px] text-surface-400 font-medium">Stok Saat Ini</span>
                                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit" 
                                          :class="getStockColor(prod.stock?.reduce((a,b)=>a+b.qty,0)||0)">
                                        {{ prod.stock?.reduce((a,b)=>a+b.qty,0) || 0 }} {{ (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 gap-3 opacity-70">
                    <div class="w-16 h-16 bg-surface-200 dark:bg-surface-800 rounded-full flex items-center justify-center">
                         <i class="pi pi-search text-2xl"></i>
                    </div>
                    <span class="text-xs font-medium">Produk tidak ditemukan</span>
                </div>
            </div>
        </div>

        <!-- KOLOM 2: KERANJANG (Fixed Width ~380px) -->
        <div class="w-[380px] flex flex-col bg-white dark:bg-surface-900 rounded-2xl shadow border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
            <div class="p-3 px-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ totalItems }}</span>
                    </div>
                    <span class="font-bold text-sm text-surface-700">Item Masuk</span>
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

            <div id="cart-items-container" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 gap-2 opacity-60">
                    <i class="pi pi-inbox text-4xl mb-1"></i>
                    <p class="text-xs font-medium">Belum ada barang dipilih</p>
                </div>

                <div v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" 
                     class="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 shadow-sm hover:border-orange-300 dark:hover:border-orange-700 transition-all group relative">
                    
                    <!-- Delete Button -->
                    <button class="absolute -top-2 -right-2 w-6 h-6 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-full shadow-sm flex items-center justify-center text-surface-400 hover:text-red-500 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 z-10 transform scale-90 group-hover:scale-100" 
                            @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>

                    <!-- Product Name -->
                    <div class="mb-3 pr-4">
                        <div class="font-bold text-xs text-surface-800 dark:text-surface-100 leading-relaxed">
                            {{ item.name }}
                        </div>
                    </div>

                    <div class="flex items-end gap-3">
                        <!-- Left: Unit & Price Controls -->
                        <div class="flex-1 flex flex-col gap-2">
                            <!-- Unit Selection (Pill Style) -->
                            <div class="inline-flex items-center h-7 bg-surface-100 dark:bg-surface-900 rounded-lg px-2 border border-surface-200 dark:border-surface-700 w-fit">
                                <span class="text-[9px] text-surface-400 font-bold uppercase mr-2 tracking-wide">Satuan</span>
                                <Dropdown 
                                    v-model="item.unitUuid" 
                                    :options="item.availableUnits" 
                                    optionLabel="unitName" 
                                    optionValue="uuid" 
                                    class="custom-pill-dropdown !h-5 !border-none !bg-transparent !shadow-none min-w-[60px] !items-center"
                                    :pt="{ 
                                        input: { class: '!p-0 !text-[11px] font-bold text-surface-700 dark:text-surface-200' }, 
                                        trigger: { class: '!w-4 text-surface-400' }
                                    }"
                                    @change="(e) => changeCartItemUnit(item, e.value)"
                                />
                            </div>

                            <!-- Buy Price Input (Integrated) -->
                            <div class="flex items-center border border-surface-200 dark:border-surface-700 rounded-lg bg-white dark:bg-surface-900 h-8 px-2 focus-within:ring-1 focus-within:ring-orange-400 focus-within:border-orange-400 transition-all">
                                <span class="text-[10px] font-bold text-surface-400 mr-1">@Rp</span>
                                <InputNumber 
                                    v-model="item.buyPrice" 
                                    mode="currency" currency="IDR" locale="id-ID" 
                                    class="w-full !h-full" 
                                    inputClass="!text-xs !h-full !p-0 !font-mono !font-bold !text-orange-600 !bg-transparent !border-none focus:!ring-0"
                                    placeholder="0" :min="0" 
                                />
                            </div>
                        </div>

                        <!-- Right: Qty & Subtotal -->
                        <div class="flex flex-col items-end justify-between h-full gap-2">
                            <!-- Qty Stepper (Compact) -->
                            <div class="flex items-center bg-surface-100 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 h-7 shadow-sm">
                                <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:bg-white hover:text-red-500 rounded-l-lg transition-colors" 
                                        @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 text-surface-800" min="1" />
                                <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:bg-white hover:text-primary-600 rounded-r-lg transition-colors" 
                                        @click="item.qty++">
                                    <i class="pi pi-plus text-[9px] font-bold"></i>
                                </button>
                            </div>

                            <!-- Subtotal -->
                            <div class="text-[11px] font-black text-surface-700 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded">
                                {{ formatCurrency(item.buyPrice * item.qty) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cart Footer -->
            <div class="p-4 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 shrink-0">
                <div class="flex justify-between items-end">
                    <span class="text-xs text-surface-500 uppercase font-bold tracking-wider mb-1">Total Estimasi</span>
                    <span class="text-2xl font-black text-surface-900 dark:text-white tracking-tight">{{ formatCurrency(grandTotal) }}</span>
                </div>
            </div>
        </div>

        <!-- KOLOM 3: FORM INFORMASI (Fixed Width ~320px) -->
        <div class="w-[320px] flex flex-col bg-white dark:bg-surface-900 rounded-2xl shadow border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
             <div class="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/30">
                 <h2 class="font-bold text-sm text-surface-700 flex items-center gap-2">
                     <div class="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center">
                        <i class="pi pi-file-edit text-orange-600 text-xs"></i>
                     </div>
                     Data Dokumen
                 </h2>
             </div>
             
             <div class="p-4 flex-1 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
                 <!-- Supplier -->
                 <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Supplier</label>
                     <div class="relative">
                        <i class="pi pi-building text-surface-400 text-xs absolute top-1/2 -translate-y-1/2 left-3"></i>
                        <InputText v-model="purchaseInfo.supplier" placeholder="Nama Supplier / Toko" 
                            class="w-full !pl-9 !py-2.5 !text-xs !rounded-xl !bg-surface-50 focus:!bg-white transition-colors" />
                     </div>
                 </div>

                 <!-- Referensi -->
                 <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">No. Referensi</label>
                     <div class="relative">
                        <i class="pi pi-hashtag text-surface-400 text-xs absolute top-1/2 -translate-y-1/2 left-3"></i>
                        <InputText v-model="purchaseInfo.referenceNo" placeholder="No. Faktur / Nota" 
                            class="w-full !pl-9 !py-2.5 !text-xs !rounded-xl !bg-surface-50 focus:!bg-white transition-colors" />
                     </div>
                 </div>

                 <!-- Catatan -->
                 <div class="space-y-1 flex-1 flex flex-col">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Catatan</label>
                     <Textarea v-model="purchaseInfo.notes" placeholder="Keterangan tambahan..." 
                        class="w-full !text-xs !rounded-xl !bg-surface-50 focus:!bg-white transition-colors !p-3 resize-none flex-1 border-surface-200" />
                 </div>
             </div>

             <!-- Footer Action -->
             <div class="p-4 bg-surface-150 relative z-10">
                <Button 
                    label="SIMPAN STOK" 
                    icon="pi pi-check-circle" 
                    iconPos="right"
                    class="w-full font-bold !py-3 !text-sm !bg-orange-500 hover:!bg-orange-600 !border-none !text-white shadow-lg shadow-orange-900/30 active:translate-y-0.5 transition-all !rounded-xl" 
                    :disabled="!canCheckout" 
                    :loading="processing" 
                    @click="processPurchase" 
                />
             </div>
        </div>

        <ProductCreateModal v-model:visible="showCreateModal" @product-created="onProductCreated" />
    </div>
</template>

<style scoped>
/* Scrollbar Halus */
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Override PrimeVue Dropdown agar rapih */
:deep(.custom-pill-dropdown .p-dropdown-label) {
    padding: 0 !important;
    display: flex;
    align-items: center;
    white-space: nowrap;
}
:deep(.custom-pill-dropdown .p-dropdown-trigger) {
    width: 16px !important;
    padding: 0 !important;
}

/* Remove Input Number Arrows/Spinner */
:deep(.p-inputnumber-input) {
    appearance: none;
    -moz-appearance: textfield;
}
:deep(.p-inputnumber-input)::-webkit-inner-spin-button, 
:deep(.p-inputnumber-input)::-webkit-outer-spin-button { 
    -webkit-appearance: none;
    margin: 0; 
}
</style>