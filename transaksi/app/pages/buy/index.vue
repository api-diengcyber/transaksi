<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick, defineAsyncComponent } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useWarehouseService } from '~/composables/useWarehouseService'; 
import { useSupplierService } from '~/composables/useSupplierService';   

// --- COMPONENT IMPORTS ---
const ProductCreateModal = defineAsyncComponent(() => import('~/components/product/ProductCreateModal.vue'));

// --- SERVICES ---
const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService(); 
const warehouseService = useWarehouseService();
const supplierService = useSupplierService();
const authStore = useAuthStore();
const toast = useToast();

// --- STATE UTAMA ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);

// --- SCAN MODE STATE ---
const isScanMode = ref(false); // <-- STATE BARU UNTUK MODE BARCODE

// --- MASTER DATA ---
const categories = ref([]); 
const warehouses = ref([]);
const suppliers = ref([]);

// --- MODAL STATES ---
const showCreateModal = ref(false); 
const showPurchaseModal = ref(false); 
const showVariantModal = ref(false);
const selectedProductForVariant = ref(null);

// --- VIEW STATE ---
const viewMode = ref('grid'); 
const gridColumns = ref(4);   
const selectedCategoryUuids = ref([]); 

// --- PAGINATION ---
const currentPage = ref(1);
const limit = 16; 
const totalPages = ref(1);
const totalProducts = ref(0);

// --- STATE TRANSAKSI (SIMPLIFIED FOR CASH ONLY) ---
const purchaseInfo = reactive({
    referenceNo: '',
    notes: '',
});

// --- COMPUTED ---
const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => total + ((item.buyPrice || 0) * (item.qty || 1)), 0);
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + (b.qty || 1), 0));

const canCheckout = computed(() => {
    if (cart.value.length === 0 || grandTotal.value <= 0) return false;
    return true;
});

const canProcessTransaction = computed(() => {
    if (processing.value) return false;
    return true;
});

const currentDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});

const gridContainerClass = computed(() => {
    if (viewMode.value === 'list') return 'flex flex-col gap-2';
    if (gridColumns.value === 3) return 'grid grid-cols-2 md:grid-cols-3 gap-3';
    if (gridColumns.value === 5) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3';
});

// --- ACTIONS & FORMATTERS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const getTotalStock = (prod) => {
    if (prod.variants && prod.variants.length > 0) return prod.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    return Number(prod.stock) || 0;
};

const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-600 border-red-200';
    if (qty < 10) return 'bg-amber-100 text-amber-600 border-amber-200';
    return 'bg-blue-50 text-blue-600 border-blue-200';
};

// --- FOKUS SCANNER ---
const focusScanner = () => {
    const input = document.getElementById('search-input-buy');
    if (input) {
        input.focus();
        toast.add({ severity: 'info', summary: 'Mode Scan Aktif', detail: 'Silakan scan barcode produk fisik Anda.', life: 2000 });
    }
};

const toggleScanMode = () => {
    isScanMode.value = !isScanMode.value;
    searchQuery.value = '';
    if (isScanMode.value) {
        nextTick(() => focusScanner());
    } else {
        handleLocalFiltering(false);
    }
};

// --- DATA FETCHING ---
const fetchMasterData = async () => {
    try {
        const cData = await categoryService.getAllCategorys();
        categories.value = Array.isArray(cData) ? cData : (cData?.data || []);
    } catch (e) {
        categories.value = [];
    }

    try {
        const wData = await warehouseService.getAllWarehouses();
        let wList = wData?.data?.data || wData?.data || wData || [];
        warehouses.value = Array.isArray(wList) ? wList : [];
    } catch (e) {
        warehouses.value = [];
    }

    try {
        let sData = null;
        if (supplierService.getSuppliers) sData = await supplierService.getSuppliers();
        else if (supplierService.getAllSuppliers) sData = await supplierService.getAllSuppliers();
        
        let sList = sData?.data?.data || sData?.data || sData || [];
        suppliers.value = Array.isArray(sList) ? sList : [];
    } catch (e) {
        suppliers.value = [];
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
            variants: p.variants || [],
            unit: p.unit || null,
            categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean)
        }));
        
        handleLocalFiltering(true);
    } catch (error) {
        console.error(error);
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

const processBarcodeScan = async () => {
    if (!searchQuery.value.trim()) return;
    const code = searchQuery.value.trim();
    
    try {
        // Asumsi API findByBarcode tersedia di composable
        const response = await productService.findByBarcode(code);
        const data = response?.data || response;
        
        if (data && data.uuid) {
            let variant = null;
            if (data.matchedVariantUuid && data.variants) {
                variant = data.variants.find(v => v.uuid === data.matchedVariantUuid);
            }
            
            if (!variant && data.variants && data.variants.length > 0) {
                selectedProductForVariant.value = data;
                showVariantModal.value = true;
            } else {
                pushToCart(data, variant);
                toast.add({ severity: 'success', summary: 'Sukses', detail: `Produk masuk keranjang`, life: 1000 });
            }
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Tidak Ditemukan', detail: 'Barcode tidak terdaftar', life: 2000 });
    } finally {
        searchQuery.value = '';
        nextTick(() => {
            const input = document.getElementById('search-input-buy');
            if (input) input.focus();
        });
    }
};

const handleLocalFiltering = (isApiLoad = false) => {
    let result = products.value;
    const query = searchQuery.value.toLowerCase().trim();
    
    if (query) {
        let exactMatch = null;
        let matchedVariant = null;

        for (const p of products.value) {
            if (p.barcode && p.barcode.toLowerCase() === query) {
                exactMatch = p; break;
            }
            if (p.variants && p.variants.length > 0) {
                const v = p.variants.find(v => v.barcode && v.barcode.toLowerCase() === query);
                if (v) {
                    exactMatch = p;
                    matchedVariant = v;
                    break;
                }
            }
        }

        if (exactMatch) {
            if (matchedVariant) {
                pushToCart(exactMatch, matchedVariant);
            } else if (exactMatch.variants && exactMatch.variants.length > 0) {
                selectedProductForVariant.value = exactMatch;
                showVariantModal.value = true;
            } else {
                pushToCart(exactMatch, null);
            }
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `Produk Ditemukan`, life: 1500 });
            filteredProducts.value = products.value; 
            return; 
        }

        if (!isApiLoad) { 
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.barcode && p.barcode.toLowerCase().includes(query))
            );
        }
    }
    filteredProducts.value = result;
};

// --- WATCHERS ---
watch(selectedCategoryUuids, () => { currentPage.value = 1; loadProducts(); });

const onSearchKeydown = async (event) => {
    if (event.key === 'Enter') {
        if (isScanMode.value) {
            await processBarcodeScan();
        } else {
            currentPage.value = 1;
            loadProducts();
        }
    }
};

// --- CART LOGIC (FOOLPROOF) ---
const openPurchaseModal = () => {
    if (cart.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Keranjang Kosong', detail: 'Pilih produk terlebih dahulu', life: 2000 });
        return;
    }
    showPurchaseModal.value = true;
};

const addToCart = (prod) => {
    if (prod.variants && prod.variants.length > 0) {
        selectedProductForVariant.value = prod;
        showVariantModal.value = true;
    } else {
        pushToCart(prod, null);
    }
};

const pushToCart = (prod, variant) => {
    try {
        const variantUuid = variant ? variant.uuid : null;
        
        const existingItemIndex = cart.value.findIndex(i => i.productUuid === prod.uuid && i.variantUuid === variantUuid);

        if (existingItemIndex !== -1) {
            cart.value[existingItemIndex].qty++;
        } else {
            const unitName = prod.unit?.name || 'Unit';
            const itemName = variant ? `${prod.name} - ${variant.name}` : prod.name;
            const unitId = prod.unit?.uuid || prod.unit_uuid || null;
            
            const availablePrices = variant ? (variant.prices || []) : (prod.prices || []);
            let basePrice = 0;
            if (availablePrices && availablePrices.length > 0) {
                const foundPrice = availablePrices.find(p => p.name && (p.name.toLowerCase().includes('umum') || p.name.toLowerCase().includes('normal')));
                basePrice = foundPrice ? foundPrice.price : availablePrices[0].price;
            }

            const defaultWarehouse = (warehouses.value && warehouses.value.length > 0) ? warehouses.value[0].uuid : null;
            const defaultSupplier = (suppliers.value && suppliers.value.length > 0) ? suppliers.value[0].uuid : null;

            const newItem = {
                productUuid: prod.uuid,
                variantUuid: variantUuid,
                name: itemName,
                unitUuid: unitId,
                unitName: unitName,
                buyPrice: Number(basePrice) || 0, 
                qty: 1,
                warehouseUuid: defaultWarehouse,
                supplierUuid: defaultSupplier,
            };

            cart.value = [...cart.value, newItem];
        }

        showVariantModal.value = false;
        selectedProductForVariant.value = null;
        
        nextTick(() => {
            const cartEl = document.getElementById('cart-items-container-buy');
            if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
        });
    } catch (err) {
        console.error("Error addToCart:", err);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terdapat kesalahan struktur data produk.', life: 3000 });
    }
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
        const itemsPayload = cart.value.map(item => ({
            product_uuid: item.productUuid,
            variant_uuid: item.variantUuid || null, 
            unit_uuid: item.unitUuid,
            qty: item.qty,
            buy_price: item.buyPrice,
            subtotal: item.qty * item.buyPrice,
            item_name: item.name,
            unit_name: item.unitName,
            
            supplier_uuid: item.supplierUuid,
            warehouse_uuid: item.warehouseUuid,

            stok_product_uuid: item.productUuid,
            stok_variant_uuid: item.variantUuid || null,
            stok_unit: item.unitUuid,
            stok_qty_plus: item.qty, 
            stok_warehouse_uuid: item.warehouseUuid 
        }));

        const payload = {
            details: {
                grand_total: grandTotal.value,
                supplier: 'Multi Supplier', 
                reference_no: purchaseInfo.referenceNo || '-',
                notes: purchaseInfo.notes,
                payment_method: 'CASH', 
                total_items_count: cart.value.length,
                items: itemsPayload 
            }
        };

        await journalService.createBuyTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Pembelian Tunai & Stok Masuk Berhasil Disimpan', life: 3000 });
        
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
    purchaseInfo.referenceNo = '';
    purchaseInfo.notes = '';
    showPurchaseModal.value = false;
};

onMounted(async () => {
    await fetchMasterData(); 
    await loadProducts();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') {
            e.preventDefault();
            toggleScanMode();
        }
    });
});

const refreshData = async () => { currentPage.value = 1; await loadProducts(); }
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 font-sans">
        
        <div class="flex-1 flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200 overflow-hidden">
            
            <div class="px-4 py-3 border-b border-surface-100 flex justify-between items-center bg-surface-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <i class="pi pi-download text-xl"></i>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold leading-tight">
                            {{ authStore.activeStore?.name || 'Stok Masuk / Pembelian' }}
                        </h1>
                        <p class="text-xs text-surface-500">
                            Operator: <span class="font-medium">{{ authStore.user?.name || 'Admin' }}</span>
                        </p>
                    </div>
                </div>
                <div class="hidden md:block text-right">
                    <div class="text-xs font-medium text-surface-500 uppercase tracking-wider mb-0.5">Hari ini</div>
                    <div class="text-sm font-bold">{{ currentDate }}</div>
                </div>
            </div>

            <div class="p-3 border-b border-surface-100 flex flex-col md:flex-row gap-2 bg-surface-0">
                <div class="w-full md:w-48">
                    <MultiSelect 
                        v-model="selectedCategoryUuids" 
                        :options="categories" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Filter Kategori" 
                        display="chip" 
                        :maxSelectedLabels="1" 
                        class="w-full !h-10 !text-sm border border-surface-200" 
                        :pt="{ label: { class: '!py-2 !px-3' } }"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <i class="pi pi-tag mr-2 text-emerald-500 text-xs"></i>
                                <span class="text-sm">{{ slotProps.option.name }}</span>
                            </div>
                        </template>
                    </MultiSelect>
                </div>
                
                <div class="relative flex-1 flex gap-2">
                    <div class="relative flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm"></i>
                        <input 
                            id="search-input-buy" 
                            v-model="searchQuery" 
                            @input="!isScanMode ? handleLocalFiltering(false) : null" 
                            type="text" 
                            :placeholder="isScanMode ? 'Tunggu scan barcode alat...' : 'Cari Manual Nama/SKU...'" 
                            class="w-full pl-9 pr-3 py-2 text-sm border rounded-lg h-10 focus:ring-emerald-500 focus:border-emerald-500" 
                            @keydown="onSearchKeydown" 
                            autocomplete="off" 
                        />
                    </div>
                    <Button 
                        icon="pi pi-barcode" 
                        v-tooltip.top="isScanMode ? 'Matikan Scanner (F2)' : 'Aktifkan Scanner (F2)'" 
                        class="!w-10 !h-10 !rounded-lg shrink-0 transition-all" 
                        :class="isScanMode ? '!bg-emerald-600 !text-white !border-emerald-600 shadow-inner' : '!bg-surface-100 !text-surface-600 !border-surface-200'"
                        @click="toggleScanMode" 
                    />
                </div>

                <div class="flex gap-1 bg-surface-100 rounded-lg p-1 h-10 border border-surface-200">
                    <button 
                        v-tooltip.bottom="'Tampilan List'"
                        @click="viewMode = 'list'"
                        class="w-8 h-full rounded flex items-center justify-center transition"
                        :class="viewMode === 'list' ? 'bg-surface-0 shadow text-emerald-600' : 'text-surface-400 hover:text-surface-600'"
                    >
                        <i class="pi pi-list text-sm"></i>
                    </button>
                    <button 
                        v-tooltip.bottom="'Tampilan Grid'"
                        @click="viewMode = 'grid'"
                        class="w-8 h-full rounded flex items-center justify-center transition"
                        :class="viewMode === 'grid' ? 'bg-surface-0 shadow text-emerald-600' : 'text-surface-400 hover:text-surface-600'"
                    >
                        <i class="pi pi-th-large text-sm"></i>
                    </button>
                    
                    <div v-if="viewMode === 'grid'" class="flex gap-1 ml-1 border-l border-surface-300 pl-1">
                        <button v-for="col in [3, 4, 5]" :key="col" @click="gridColumns = col" 
                             class="w-6 h-full rounded text-[10px] font-bold transition hidden lg:flex items-center justify-center"
                             :class="gridColumns === col ? 'bg-surface-0 shadow text-emerald-600' : 'text-surface-400 hover:text-surface-600'"
                        >
                            {{ col }}
                        </button>
                    </div>
                </div>

                <Button icon="pi pi-plus" class="!w-10 !h-10 !rounded-lg" severity="success" outlined v-tooltip.bottom="'Produk Baru'" @click="showCreateModal = true" />
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 scrollbar-thin flex flex-col">
                
                <div v-if="isScanMode" class="flex-1 flex flex-col items-center justify-center bg-surface-0/80 rounded-xl border-2 border-dashed border-emerald-200 m-2 min-h-[400px]">
                    <div class="p-6 bg-emerald-50 rounded-full mb-4 shadow-inner">
                        <i class="pi pi-barcode text-7xl text-emerald-500 animate-pulse"></i>
                    </div>
                    <h2 class="text-2xl font-black text-surface-800">Mode Scan Aktif</h2>
                    <p class="text-surface-500 text-center mt-2 max-w-sm">
                        Silakan scan barcode produk fisik Anda menggunakan alat pemindai. Produk akan otomatis ditambahkan ke keranjang pembelian.
                    </p>
                    <Button label="Matikan Scanner" icon="pi pi-times" outlined severity="secondary" size="small" class="mt-6 !rounded-full" @click="toggleScanMode" />
                </div>

                <template v-else>
                    <div v-if="loading" class="flex-1 flex justify-center items-center"><ProgressSpinner style="width: 40px; height: 40px" /></div>
                    
                    <div v-else-if="filteredProducts.length > 0" class="flex-1">
                        <div :class="gridContainerClass">
                            <div 
                                v-for="prod in filteredProducts" 
                                :key="prod.uuid" 
                                @click="addToCart(prod)" 
                                class="group relative bg-surface-0 border border-surface-200 rounded-xl cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 select-none"
                                :class="viewMode === 'grid' ? 'p-3 flex flex-col justify-between h-32' : 'p-2 flex items-center justify-between gap-3 h-16'"
                            >
                                <template v-if="viewMode === 'grid'">
                                    <div class="flex flex-col h-full justify-between">
                                        <div>
                                            <div class="text-xs font-bold line-clamp-2 mb-1 leading-snug group-hover:text-emerald-600 transition-colors pr-1">{{ prod.name }}</div>
                                            <div class="text-[9px] text-surface-400 font-mono mb-1 truncate"><i class="pi pi-barcode mr-1"></i>{{ prod.barcode || 'N/A' }}</div>
                                        </div>
                                        
                                        <div>
                                            <div class="flex gap-1 mt-1 items-center">
                                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(getTotalStock(prod))">Stok: {{ getTotalStock(prod) }}</span>
                                                <Tag v-if="prod.variants && prod.variants.length > 0" value="Multi Varian" severity="success" class="!text-[8px] !px-1.5 !py-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                </template>

                                <template v-else>
                                    <div class="flex items-center gap-3 flex-1 overflow-hidden">
                                        <div class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 shrink-0">
                                            <i class="pi pi-box"></i>
                                        </div>
                                        <div class="flex flex-col overflow-hidden">
                                            <div class="text-sm font-bold truncate group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                                                {{ prod.name }}
                                                <Tag v-if="prod.variants && prod.variants.length > 0" value="Multi Varian" severity="success" class="!text-[8px] !px-1.5" />
                                            </div>
                                            <div class="flex gap-2 items-center mt-0.5">
                                                <span class="text-[10px] text-surface-400 font-mono"><i class="pi pi-barcode text-[9px] mr-0.5"></i>{{ prod.barcode || 'N/A' }}</span>
                                                <span class="text-[10px] font-medium text-surface-500">Stok: {{ getTotalStock(prod) }}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-end shrink-0">
                                        <i class="pi pi-plus-circle text-emerald-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                    
                    <div v-else class="flex-1 flex flex-col items-center justify-center text-surface-400 gap-2 opacity-60">
                        <i class="pi pi-search text-4xl"></i>
                        <span class="text-xs">Produk tidak ditemukan</span>
                    </div>

                    <div v-if="totalPages > 1 && !loading" class="mt-4 flex justify-between items-center border-t border-surface-200 pt-3 sticky bottom-0 bg-surface-50 z-10">
                        <Button icon="pi pi-chevron-left" label="Sebelumnya" size="small" text :disabled="currentPage === 1" @click="changePage(currentPage - 1)" class="!text-xs" />
                        <span class="text-xs font-medium text-surface-600">Halaman <span class="font-bold text-emerald-600">{{ currentPage }}</span> dari {{ totalPages }} <span class="text-[10px] ml-1">({{ totalProducts }} total)</span></span>
                        <Button label="Selanjutnya" icon="pi pi-chevron-right" iconPos="right" size="small" text :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)" class="!text-xs" />
                    </div>
                </template>
            </div>
        </div>

        <div class="w-full lg:w-[450px] xl:w-[500px] flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200 overflow-hidden shrink-0 h-[600px] lg:h-auto">
            <div class="p-3 border-b border-surface-100 bg-surface-50/50 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><span class="font-bold text-xs">{{ totalItems }}</span></div>
                    <span class="font-bold text-sm">List Item Pembelian</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container-buy" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30">
                 
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-400 gap-3 opacity-60 min-h-[300px]" @click="focusScanner">
                    <div class="w-32 h-32 flex items-center justify-center mb-2 cursor-pointer hover:scale-105 transition-transform">
                        <i class="pi pi-barcode text-7xl text-surface-300"></i>
                    </div>
                    <p class="text-sm font-bold text-surface-600">Belum ada item dipilih</p>
                    <p class="text-xs text-center text-surface-500 px-4 leading-relaxed">
                        Silakan arahkan kursor ke pencarian dan<br/>
                        <span class="font-bold text-emerald-600 border-b border-emerald-300">Scan Barcode</span> pada produk fisik Anda.
                    </p>
                </div>
                
                <div v-for="(item, index) in cart" :key="index" class="group border border-surface-200 rounded-xl p-2.5 hover:border-emerald-300 transition-all shadow-sm relative bg-surface-0">
                    <button class="absolute -top-2 -right-2 shadow border border-surface-200 bg-surface-0 text-surface-400 hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>
                    
                    <div class="mb-2 pr-4 flex justify-between items-start">
                        <div class="text-sm font-bold line-clamp-2" :title="item.name">{{ item.name }}</div>
                        <span class="bg-surface-100 text-surface-600 text-[9px] font-bold px-2 py-1 rounded ml-2 shrink-0">{{ item.unitName }}</span>
                    </div>
                    
                    <div class="flex flex-col gap-2 mt-2 pt-2 border-t border-surface-100">
                        
                        <div class="flex gap-2">
                            <div class="flex-1">
                                <label class="text-[9px] font-bold text-surface-500 mb-0.5 block uppercase">Gudang Penyimpanan</label>
                                <Dropdown v-model="item.warehouseUuid" :options="warehouses" optionLabel="name" optionValue="uuid" placeholder="Pilih..." class="w-full !h-7 !text-[10px]" :pt="{ root: { class: '!bg-surface-50 !border-surface-200' }, input: { class: '!py-1 !px-2' }, trigger: { class: '!w-6' } }" />
                            </div>
                            <div class="flex-1">
                                <label class="text-[9px] font-bold text-surface-500 mb-0.5 block uppercase">Supplier</label>
                                <Dropdown v-model="item.supplierUuid" :options="suppliers" optionLabel="username" optionValue="uuid" placeholder="Pilih..." class="w-full !h-7 !text-[10px]" :pt="{ root: { class: '!bg-surface-50 !border-surface-200' }, input: { class: '!py-1 !px-2' }, trigger: { class: '!w-6' } }" />
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-3 mt-1">
                            <div class="flex-1">
                                <label class="text-[9px] font-bold text-surface-500 mb-0.5 block">Harga Beli (Modal)</label>
                                <div class="relative">
                                    <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-surface-400">Rp</span>
                                    <InputNumber v-model="item.buyPrice" mode="decimal" locale="id-ID" class="!h-7 w-full" inputClass="!text-xs !h-7 !py-0 !pl-7 !pr-2 !font-mono !font-bold !text-emerald-600 !rounded-lg !bg-surface-50 !border-surface-200 focus:!border-emerald-500 focus:!ring-1" :min="0" />
                                </div>
                            </div>
                            <div class="shrink-0 w-24">
                                <label class="text-[9px] font-bold text-surface-500 mb-0.5 block text-center">Kuantitas (Qty)</label>
                                <div class="flex items-center bg-surface-100 rounded-lg border border-surface-200 h-7 w-full">
                                    <button class="w-7 h-full flex items-center justify-center hover:bg-surface-200 rounded-l-lg transition text-surface-600 hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)"><i class="pi pi-minus text-[9px] font-bold"></i></button>
                                    <input v-model="item.qty" type="number" class="w-full h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 focus:ring-0" min="1" />
                                    <button class="w-7 h-full flex items-center justify-center hover:bg-surface-200 rounded-r-lg transition text-emerald-600" @click="item.qty++"><i class="pi pi-plus text-[9px] font-bold"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="text-right mt-1">
                            <div class="text-[9px] text-surface-400 uppercase tracking-widest">Subtotal Barang</div>
                            <div class="text-sm font-black text-surface-800">{{ formatCurrency((item.buyPrice || 0) * (item.qty || 1)) }}</div>
                        </div>

                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-surface-200 space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 bg-surface-0">
                <div class="flex justify-between items-end">
                    <span class="text-sm text-surface-500 uppercase font-bold tracking-wider mb-1">Total Modal</span>
                    <span class="text-2xl font-black text-surface-900">{{ formatCurrency(grandTotal) }}</span>
                </div>
                <Button label="Selesaikan Pembelian" icon="pi pi-arrow-right" iconPos="right" class="w-full !h-12 !text-base !font-bold" severity="success" @click="openPurchaseModal" :disabled="!canCheckout" />
            </div>
        </div>

        <Dialog v-model:visible="showVariantModal" header="Pilih Varian Masuk" modal class="w-full max-w-md" :pt="{ header: { class: '!pb-2 !border-b !border-surface-200' }, content: { class: '!pt-4' } }">
            <div v-if="selectedProductForVariant" class="flex flex-col gap-4">
                <div class="text-center">
                    <div class="font-bold text-lg text-surface-800">{{ selectedProductForVariant.name }}</div>
                    <div class="text-xs text-surface-500 mt-1">Silakan pilih varian yang stoknya bertambah.</div>
                </div>
                <div class="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto scrollbar-thin px-1">
                    <button v-for="v in selectedProductForVariant.variants" :key="v.uuid"
                            @click="pushToCart(selectedProductForVariant, v)"
                            class="group flex justify-between items-center p-3 border border-surface-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-sm transition-all text-left bg-surface-0">
                        <div>
                            <div class="font-bold text-sm text-surface-800 group-hover:text-emerald-700 transition">{{ v.name }}</div>
                            <div class="text-[10px] text-surface-500 mt-1 flex items-center gap-2">
                                <span><i class="pi pi-barcode text-[9px]"></i> {{ v.barcode || '-' }}</span>
                                <span :class="getStockColor(Number(v.stock))" class="px-1.5 py-0.5 rounded border font-semibold">Stok Saat Ini: {{ v.stock || 0 }}</span>
                            </div>
                        </div>
                        <i class="pi pi-plus-circle text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity text-xl"></i>
                    </button>
                </div>
            </div>
        </Dialog>

        <ProductCreateModal v-model:visible="showCreateModal" @product-created="onProductCreated" />
    </div>

    <Dialog v-model:visible="showPurchaseModal" class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm transition-all" :pt="{ root: { class: '!border-0 !shadow-2xl !bg-transparent' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-xl !bg-surface-0' } }" modal dismissableMask>
        <div class="bg-surface-0 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            <div class="flex justify-between items-center p-4 border-b border-surface-200 bg-surface-50">
                <h3 class="font-bold text-lg">Penyelesaian Transaksi</h3>
                <button @click="showPurchaseModal = false" class="text-surface-400 hover:text-surface-600 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-200">
                    <i class="pi pi-times"></i>
                </button>
            </div>

            <div class="p-5 overflow-y-auto scrollbar-thin space-y-4">
                
                <div class="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span class="text-xs uppercase text-surface-500 tracking-widest font-bold">Total Pembayaran Lunas</span>
                    <div class="text-3xl font-black text-emerald-700 mt-1">
                        {{ formatCurrency(grandTotal) }}
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">No. Referensi / Nota Pembelian</label>
                        <InputText v-model="purchaseInfo.referenceNo" placeholder="Contoh: INV-001 / Nota dari toko..." class="w-full !text-sm" />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Catatan Tambahan</label>
                        <Textarea v-model="purchaseInfo.notes" rows="2" placeholder="Catatan opsional (Cth: Dikirim via kurir)..." class="w-full !text-sm resize-none" />
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-surface-200 bg-surface-50 flex gap-3">
                <Button label="Batal" class="flex-1" severity="secondary" outlined @click="showPurchaseModal = false" />
                <Button 
                    label="Simpan Pembelian & Stok" 
                    :icon="processing ? 'pi pi-spinner pi-spin' : 'pi pi-check'" 
                    class="flex-[2] font-bold"
                    severity="success"
                    :loading="processing" 
                    :disabled="!canProcessTransaction"
                    @click="processPurchase"
                />
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
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
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>