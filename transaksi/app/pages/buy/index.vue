<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store'; // Import Auth Store
import ProductCreateModal from '~/components/product/ProductCreateModal.vue'; 

// --- SERVICES ---
const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService(); 
const authStore = useAuthStore(); // Init Store
const toast = useToast();

// --- STATE UTAMA ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);
const showCreateModal = ref(false); 
const showPurchaseModal = ref(false); // State untuk Modal Checkout

// --- VIEW STATE (BARU) ---
const viewMode = ref('grid'); // 'grid' | 'list'
const gridColumns = ref(4);   // 3 | 4 | 5

const categories = ref([]); 
const selectedCategoryUuids = ref([]); 

// --- PAGINATION ---
const currentPage = ref(1);
const limit = 16; 
const totalPages = ref(1);
const totalProducts = ref(0);

// --- STATE TRANSAKSI ---
const purchaseInfo = reactive({
    supplier: '',
    referenceNo: '',
    notes: '',
    paymentMethod: 'CASH', 
    dueDate: null, 
});

// --- COMPUTED ---
const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => {
        return total + (item.buyPrice * item.qty);
    }, 0);
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

const isCreditBuy = computed(() => purchaseInfo.paymentMethod === 'CREDIT'); 

const canCheckout = computed(() => {
    if (cart.value.length === 0 || grandTotal.value <= 0) return false;
    // Validasi tambahan bisa ditaruh di sini
    return true;
});

const canProcessTransaction = computed(() => {
    // Validasi di dalam Modal
    if (processing.value) return false;
    if (isCreditBuy.value && !purchaseInfo.dueDate) return false;
    return true;
});

// Helper Tanggal Header
const currentDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
});

// Helper Grid Class Dinamis
const gridContainerClass = computed(() => {
    if (viewMode.value === 'list') {
        return 'flex flex-col gap-2';
    }
    // Mobile selalu 2 kolom, Desktop sesuai setting
    if (gridColumns.value === 3) return 'grid grid-cols-2 md:grid-cols-3 gap-3';
    if (gridColumns.value === 5) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';
    // Default 4
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3';
});

// --- ACTIONS ---

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        currentPage.value = 1;
        loadProducts();
    }
};

const fetchCategories = async () => {
    try {
        const data = await categoryService.getAllCategorys();
        categories.value = data || [];
    } catch (e) { 
        console.error("Gagal memuat kategori:", e);
    }
};

const loadProducts = async () => {
    loading.value = true;
    products.value = [];
    try {
        const currentQuery = searchQuery.value.toLowerCase().trim();
        const categoryUuids = selectedCategoryUuids.value.join(','); 
        
        const response = await productService.getAllProducts(currentPage.value, limit, currentQuery, categoryUuids); 
        const data = response?.data || response || []; 
        
        totalPages.value = response?.meta?.totalPage || response?.meta?.total_page || 1;
        totalProducts.value = response?.meta?.total || 0;
        
        products.value = data.map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean)
        }));
        
        handleLocalFiltering(true);
    } catch (error) {
        console.error("Gagal memuat produk:", error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data produk.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
        currentPage.value = newPage;
        loadProducts();
    }
};

const handleLocalFiltering = (isApiLoad = false) => {
    let result = products.value;
    const query = searchQuery.value.toLowerCase().trim();
    
    if (query) {
        // Scan Barcode Logic
        const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));
        if (exactProduct) {
            const matchedUnit = exactProduct.units.find(u => u.barcode === query);
            addToCart(exactProduct, matchedUnit);
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name}`, life: 1500 });
            filteredProducts.value = products.value; 
            return; 
        }

        if (!isApiLoad) { 
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.units.some(u => u.barcode?.includes(query))
            );
        }
    }
    filteredProducts.value = result;
};

// --- WATCHERS ---
watch(selectedCategoryUuids, () => { currentPage.value = 1; loadProducts(); });
watch(searchQuery, () => { handleLocalFiltering(false); });

// --- CART LOGIC ---

const openPurchaseModal = () => {
    if (cart.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Keranjang Kosong', detail: 'Pilih produk terlebih dahulu', life: 2000 });
        return;
    }
    showPurchaseModal.value = true;
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
        
        nextTick(() => {
            const cartEl = document.getElementById('cart-items-container-buy');
            if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
        });
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
    currentPage.value = 1;
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) {
        addToCart(fullProduct);
        toast.add({ severity: 'info', summary: 'Info', detail: 'Produk baru masuk list pembelian', life: 3000 });
    }
};

// --- TRANSACTION ---

const processPurchase = async () => {
    if (!canProcessTransaction.value) return;

    processing.value = true;
    try {
        const payload = {
            details: {
                grand_total: grandTotal.value,
                supplier: purchaseInfo.supplier || 'Umum',
                reference_no: purchaseInfo.referenceNo || '-',
                notes: purchaseInfo.notes,
                payment_method: purchaseInfo.paymentMethod, 
                total_items_count: cart.value.length,
                
                ...(isCreditBuy.value && { 
                    is_credit: 'true', 
                    due_date: purchaseInfo.dueDate
                }),
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
        
        const msg = isCreditBuy.value ? 'Pembelian Kredit Berhasil Dicatat' : 'Stok Masuk Berhasil Disimpan';
        toast.add({ severity: 'success', summary: 'Sukses', detail: msg, life: 3000 });
        
        resetState();
        await loadProducts(); 

    } catch (e) {
        console.error("Error processing purchase:", e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Transaksi gagal diproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const resetState = () => {
    cart.value = [];
    purchaseInfo.supplier = '';
    purchaseInfo.referenceNo = '';
    purchaseInfo.notes = '';
    purchaseInfo.paymentMethod = 'CASH';
    purchaseInfo.dueDate = null;
    showPurchaseModal.value = false;
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
const getDefaultUnitStock = (prod) => (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.currentStock || 0; 
const getDefaultUnitName = (prod) => (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName;
const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-600 border-red-200 ';
    if (qty < 10) return 'bg-amber-100 text-amber-600 border-amber-200';
    return 'bg-blue-50 text-blue-600 border-blue-200  ';
};

onMounted(async () => {
    await fetchCategories(); 
    await loadProducts();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            document.getElementById('search-input-buy')?.focus();
        }
    });
});

const refreshData = async () => { currentPage.value = 1; await loadProducts(); }
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 font-sans">
        
        <div class="flex-1 flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200  overflow-hidden">
            
            <div class="px-4 py-3 border-b border-surface-100  flex justify-between items-center bg-surface-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 ">
                        <i class="pi pi-download text-xl"></i>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold  leading-tight">
                            {{ authStore.activeStore?.name || 'Stok Masuk / Pembelian' }}
                        </h1>
                        <p class="text-xs text-surface-500 ">
                            Operator: <span class="font-medium ">{{ authStore.user?.name || 'Admin' }}</span>
                        </p>
                    </div>
                </div>
                <div class="hidden md:block text-right">
                    <div class="text-xs font-medium text-surface-500  uppercase tracking-wider mb-0.5">Hari ini</div>
                    <div class="text-sm font-bold ">
                        {{ currentDate }}
                    </div>
                </div>
            </div>

            <div class="p-3 border-b border-surface-100  flex flex-col md:flex-row gap-2 bg-surface-0">
                <div class="w-full md:w-48">
                    <MultiSelect 
                        v-model="selectedCategoryUuids" 
                        :options="categories" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Filter Kategori" 
                        display="chip" 
                        :maxSelectedLabels="1" 
                        class="w-full !h-10 !text-sm  border border-surface-200 " 
                        :pt="{ label: { class: '!py-2 !px-3' } }"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center ">
                                <i class="pi pi-tag mr-2 text-orange-500 text-xs"></i>
                                <span class="text-sm">{{ slotProps.option.name }}</span>
                            </div>
                        </template>
                    </MultiSelect>
                </div>
                
                <div class="relative flex-1">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400  text-sm"></i>
                    <input 
                        id="search-input-buy" 
                        v-model="searchQuery" 
                        type="text" 
                        placeholder="Cari Produk / Scan Barcode... (F2)" 
                        class="w-full pl-9 pr-3 py-2 text-sm  border border-surface-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-sm h-10" 
                        @keydown="onSearchKeydown" 
                        @input="handleLocalFiltering" 
                        autocomplete="off" 
                    />
                </div>

                <div class="flex gap-1 bg-surface-100 rounded-lg p-1 h-10 border border-surface-200 ">
                    <button 
                        v-tooltip.bottom="'Tampilan List'"
                        @click="viewMode = 'list'"
                        class="w-8 h-full rounded flex items-center justify-center transition"
                        :class="viewMode === 'list' ? 'bg-surface-0  shadow text-orange-600' : 'text-surface-400 hover:text-surface-600 '"
                    >
                        <i class="pi pi-list text-sm"></i>
                    </button>
                    <button 
                        v-tooltip.bottom="'Tampilan Grid'"
                        @click="viewMode = 'grid'"
                        class="w-8 h-full rounded flex items-center justify-center transition"
                        :class="viewMode === 'grid' ? 'bg-surface-0  shadow text-orange-600' : 'text-surface-400 hover:text-surface-600 '"
                    >
                        <i class="pi pi-th-large text-sm"></i>
                    </button>
                    
                    <div v-if="viewMode === 'grid'" class="flex gap-1 ml-1 border-l border-surface-300 pl-1">
                        <button v-for="col in [3, 4, 5]" :key="col" @click="gridColumns = col" 
                             class="w-6 h-full rounded text-[10px] font-bold transition hidden lg:flex items-center justify-center"
                             :class="gridColumns === col ? 'bg-surface-0  shadow text-orange-600' : 'text-surface-400 hover:text-surface-600 '"
                        >
                            {{ col }}
                        </button>
                    </div>
                </div>

                <Button icon="pi pi-plus" class="!w-10 !h-10 !rounded-lg" severity="warning" outlined v-tooltip.bottom="'Produk Baru'" @click="showCreateModal = true" />
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 scrollbar-thin flex flex-col">
                <div v-if="loading" class="flex-1 flex justify-center items-center"><ProgressSpinner style="width: 40px; height: 40px" /></div>
                
                <div v-else-if="filteredProducts.length > 0" class="flex-1">
                    
                    <div :class="gridContainerClass">
                        <div 
                            v-for="prod in filteredProducts" 
                            :key="prod.uuid" 
                            @click="addToCart(prod)" 
                            class="group relative bg-surface-0 border border-surface-200  rounded-xl cursor-pointer hover:border-orange-400 hover:shadow-md transition-all active:scale-95 select-none"
                            :class="viewMode === 'grid' ? 'p-3 flex flex-col justify-between h-28' : 'p-2 flex items-center justify-between gap-3 h-16'"
                        >
                            <template v-if="viewMode === 'grid'">
                                <div>
                                    <div class="text-xs font-bold  line-clamp-2 mb-1 leading-snug group-hover:text-orange-600 transition-colors">{{ prod.name }}</div>
                                    <div class="flex gap-1 mt-1">
                                        <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(getDefaultUnitStock(prod))">Stok: {{ getDefaultUnitStock(prod) }}</span>
                                        <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 text-surface-500  border border-surface-200 ">{{ getDefaultUnitName(prod) }}</span>
                                    </div>
                                </div>
                                <div class="flex justify-between items-end mt-2">
                                    <span class="text-[9px] text-surface-400 truncate max-w-[100%]">{{ categories.find(c => c.uuid === prod.categoryUuids[0])?.name || 'Umum' }}</span>
                                </div>
                            </template>

                            <template v-else>
                                <div class="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 shrink-0">
                                        <i class="pi pi-box"></i>
                                    </div>
                                    <div class="flex flex-col overflow-hidden">
                                        <div class="text-sm font-bold  truncate group-hover:text-orange-600 transition-colors">{{ prod.name }}</div>
                                        <div class="flex gap-1.5 items-center mt-0.5">
                                            <span class="text-[9px] font-medium px-1.5 py-0.5 rounded border" :class="getStockColor(getDefaultUnitStock(prod))">{{ getDefaultUnitStock(prod) }} {{ getDefaultUnitName(prod) }}</span>
                                            <span class="text-[10px] text-surface-400 truncate hidden sm:inline">{{ categories.find(c => c.uuid === prod.categoryUuids[0])?.name || 'Umum' }}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex flex-col items-end shrink-0">
                                    <i class="pi pi-plus-circle text-orange-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
                
                <div v-else class="flex-1 flex flex-col items-center justify-center text-surface-400  gap-2 opacity-60">
                    <i class="pi pi-search text-4xl"></i>
                    <span class="text-xs">Produk tidak ditemukan</span>
                </div>

                <div v-if="totalPages > 1 && !loading" class="mt-4 flex justify-between items-center border-t border-surface-200  pt-3 sticky bottom-0 bg-surface-50 z-10">
                    <Button icon="pi pi-chevron-left" label="Sebelumnya" size="small" text :disabled="currentPage === 1" @click="changePage(currentPage - 1)" class="!text-xs" />
                    <span class="text-xs font-medium text-surface-600 ">Halaman <span class="font-bold text-orange-600">{{ currentPage }}</span> dari {{ totalPages }} <span class="text-[10px] ml-1">({{ totalProducts }} total)</span></span>
                    <Button label="Selanjutnya" icon="pi pi-chevron-right" iconPos="right" size="small" text :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)" class="!text-xs" />
                </div>
            </div>
        </div>

        <div class="w-full lg:w-[420px] flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200  overflow-hidden shrink-0 h-[600px] lg:h-auto">
            <div class="p-3 border-b border-surface-100  bg-surface-50/50 /50 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><span class="font-bold text-xs">{{ totalItems }}</span></div>
                    <span class="font-bold text-sm ">Item Masuk</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container-buy" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30 /30">
                 <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 gap-3">
                    <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center"><i class="pi pi-inbox text-2xl opacity-40"></i></div>
                    <p class="text-xs">Belum ada item dipilih</p>
                </div>
                
                <div v-for="(item, index) in cart" :key="index" class="group  border border-surface-200  rounded-xl p-2.5 hover:border-orange-300 transition-all shadow-sm relative">
                    <button class="absolute -top-2 -right-2  shadow border border-surface-200  text-surface-400  hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>
                    
                    <div class="mb-2 pr-4"><div class="text-sm font-bold  line-clamp-1" :title="item.name">{{ item.name }}</div></div>
                    
                    <div class="flex items-end gap-2">
                        <div class="flex-1 flex flex-col gap-1.5">
                             <div class="flex gap-2 items-center">
                                <Dropdown v-model="item.unitUuid" :options="item.availableUnits" optionLabel="unitName" optionValue="uuid" class="custom-tiny-dropdown !h-6 !w-24 !bg-surface-50  !border-surface-200  !shadow-none !rounded-lg !flex !items-center" :pt="{ input: { class: '!py-0 !px-2 !text-[10px] !font-bold !text-surface-700' }, trigger: { class: '!w-5 !text-surface-400' }, panel: { class: '!text-xs' }, item: { class: '!py-1.5 !px-3 !text-xs' } }" @change="(e) => changeCartItemUnit(item, e.value)" />
                            </div>
                            <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-surface-400">Rp</span>
                                <InputNumber v-model="item.buyPrice" mode="currency" currency="IDR" locale="id-ID" class="!h-7 w-full" inputClass="!text-xs !h-7 !py-0 !pl-6 !pr-2 !font-mono !font-bold !text-orange-600 !rounded-lg !bg-surface-50  !border-surface-200  focus:!border-orange-500 focus:!ring-1" :min="0" placeholder="Harga Beli" />
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1.5">
                            <div class="flex items-center bg-surface-100 rounded-lg border border-surface-200  h-7">
                                <button class="w-7 h-full flex items-center justify-center hover: rounded-l-lg transition text-surface-600  hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)"><i class="pi pi-minus text-[9px] font-bold"></i></button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 " min="1" />
                                <button class="w-7 h-full flex items-center justify-center hover: rounded-r-lg transition text-orange-600" @click="item.qty++"><i class="pi pi-plus text-[9px] font-bold"></i></button>
                            </div>
                            <div class="text-xs font-black  bg-surface-50 px-2 py-1 rounded border border-surface-200 ">{{ formatCurrency(item.buyPrice * item.qty) }}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4  border-t border-surface-200  space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                <div class="flex justify-between items-end">
                    <span class="text-sm text-surface-500  uppercase font-bold tracking-wider mb-1">Total Estimasi</span>
                    <span class="text-2xl font-black text-surface-900 ">{{ formatCurrency(grandTotal) }}</span>
                </div>
                <Button label="Lanjut Proses" icon="pi pi-arrow-right" iconPos="right" class="w-full !h-12 !text-base !font-bold" severity="warning" @click="openPurchaseModal" :disabled="!canCheckout" />
            </div>
        </div>

        <ProductCreateModal v-model:visible="showCreateModal" @product-created="onProductCreated" />
    </div>

    <div v-if="showPurchaseModal" class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm transition-all">
        <div class="bg-surface-0 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            <div class="flex justify-between items-center p-4 border-b border-surface-200  bg-surface-50">
                <h3 class="font-bold text-lg ">Rincian Pembelian</h3>
                <button @click="showPurchaseModal = false" class="text-surface-400 hover:text-surface-600  transition">
                    <i class="pi pi-times text-lg"></i>
                </button>
            </div>

            <div class="p-5 overflow-y-auto scrollbar-thin space-y-4">
                
                <div class="text-center p-4 bg-orange-50 rounded-xl border border-orange-100 ">
                    <span class="text-xs uppercase text-surface-500  tracking-widest font-bold">Total Belanja</span>
                    <div class="text-3xl font-black text-orange-700  mt-1">
                        {{ formatCurrency(grandTotal) }}
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Supplier / Toko</label>
                        <InputText v-model="purchaseInfo.supplier" placeholder="Nama Supplier (Opsional)..." class="w-full !text-sm" />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">No. Referensi / Nota</label>
                        <InputText v-model="purchaseInfo.referenceNo" placeholder="Nomor Faktur..." class="w-full !text-sm" />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Metode Pembayaran</label>
                        <SelectButton v-model="purchaseInfo.paymentMethod" 
                            :options="[{label: 'Lunas (Cash/Transfer)', value: 'CASH'}, {label: 'Hutang (Kredit)', value: 'CREDIT'}]"
                            optionLabel="label" optionValue="value"
                            class="w-full"
                            :pt="{ button: { class: '!text-xs !py-3 flex-1' } }"
                        />
                    </div>

                    <div v-if="isCreditBuy" class="space-y-1 bg-red-50 p-3 rounded-lg border border-red-100  animate-fade-in-down">
                        <label class="text-xs font-bold text-red-600  uppercase">Jatuh Tempo <span class="text-red-500">*</span></label>
                        <Calendar v-model="purchaseInfo.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full" inputClass="!text-xs" placeholder="Pilih Tanggal..." />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Catatan</label>
                        <Textarea v-model="purchaseInfo.notes" rows="2" placeholder="Catatan tambahan..." class="w-full !text-sm resize-none" />
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-surface-200  bg-surface-50 flex gap-3">
                <Button label="Batal" class="flex-1" severity="secondary" outlined @click="showPurchaseModal = false" />
                <Button 
                    :label="isCreditBuy ? 'Simpan Hutang' : 'Simpan Stok'" 
                    :icon="processing ? 'pi pi-spinner pi-spin' : 'pi pi-check'" 
                    class="flex-[2]"
                    :severity="isCreditBuy ? 'danger' : 'success'"
                    :loading="processing" 
                    :disabled="!canProcessTransaction"
                    @click="processPurchase"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Custom Scrollbar */
.scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 20px;
}
.custom-tiny-dropdown :deep(.p-dropdown-label) {
    padding: 0 0.5rem !important;
}
</style>