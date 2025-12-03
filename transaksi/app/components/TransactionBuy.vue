<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProductCreateModal from '~/components/ProductCreateModal.vue'; 

const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService(); 
const toast = useToast();

// --- STATE PAGINATION & PRODUCT ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);
const showCreateModal = ref(false); 

const categories = ref([]); 
const selectedCategoryUuids = ref([]); 

// [PAGINASI] State
const currentPage = ref(1);
const limit = 16; // Jumlah produk per halaman
const totalPages = ref(1);
const totalProducts = ref(0);

// State khusus Pembelian
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

const isCreditBuy = computed(() => purchaseInfo.paymentMethod === 'CREDIT'); 

const canCheckout = computed(() => {
    if (cart.value.length === 0 || grandTotal.value <= 0) return false;
    if (isCreditBuy.value && !purchaseInfo.dueDate) return false;
    return true;
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

// --- ACTIONS ---

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        currentPage.value = 1; // Reset halaman ke 1 saat pencarian baru
        loadProducts(); // Panggil API search
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

// [UPDATED] Load Products dengan Paginasi dan Filter Kategori/Search via API
const loadProducts = async () => {
    loading.value = true;
    products.value = []; // Reset tampilan saat loading

    try {
        const currentQuery = searchQuery.value.toLowerCase().trim();
        const categoryUuids = selectedCategoryUuids.value.join(','); 
        
        // Panggil API dengan parameter page, limit, query, dan categoryUuids
        // ASUMSI: productService.getAllProducts(page, limit, query, categoryUuids)
        const response = await productService.getAllProducts(
            currentPage.value, 
            limit, 
            currentQuery, 
            categoryUuids 
        ); 
        
        // Cek struktur respons untuk mendapatkan data dan meta
        const data = response?.data || response || []; 
        
        // Ambil data paginasi dari meta
        totalPages.value = response?.meta?.totalPage || response?.meta?.total_page || 1;
        totalProducts.value = response?.meta?.total || 0;
        
        if (!Array.isArray(data)) {
            throw new Error("Format data produk dari server tidak valid.");
        }
        
        products.value = data.map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean)
        }));
        
        handleSearch(true); // Panggil handleSearch setelah API load
        
    } catch (error) {
        console.error("Gagal memuat produk dari API:", error); 
        const errorDetail = error.message || 'Terjadi kesalahan jaringan atau server.';
        
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: `Gagal memuat produk: ${errorDetail}`, 
            life: 5000 
        });
        
        products.value = []; 
        filteredProducts.value = [];
        
    } finally {
        loading.value = false;
    }
};

// [BARU] Fungsi Navigasi Halaman
const changePage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
        currentPage.value = newPage;
        loadProducts();
    }
};


// [UPDATED] handleSearch hanya untuk filter instant dan scan barcode
const handleSearch = (isApiLoad = false) => {
    let result = products.value;
    const query = searchQuery.value.toLowerCase().trim();
    
    // Scan Barcode (Prioritas Tinggi)
    if (query) {
        const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));
        if (exactProduct) {
            const matchedUnit = exactProduct.units.find(u => u.barcode === query);
            addToCart(exactProduct, matchedUnit);
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name} ditambahkan`, life: 1500 });
            // Tidak perlu memanggil loadProducts lagi, cukup reset filteredProducts
            filteredProducts.value = products.value; 
            return; 
        }

        // Filter Teks Lokal (Hanya untuk instant search di halaman yang sedang dimuat)
        // Jika isApiLoad=true, pencarian teks sudah ditangani API (di onSearchKeydown)
        if (!isApiLoad) { 
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.units.some(u => u.barcode?.includes(query))
            );
        }
    }

    filteredProducts.value = result;
};

// Watchers
watch(selectedCategoryUuids, () => {
    currentPage.value = 1; // Reset ke halaman 1 saat kategori berubah
    loadProducts();
});

watch(searchQuery, () => {
    // Saat mengetik, lakukan filtering instan lokal, bukan memanggil API (kecuali Enter)
    handleSearch(false);
});


// Helper untuk mendapatkan Stok Unit Default
const getDefaultUnitStock = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.currentStock || 0; 
};

// Helper untuk mendapatkan Nama Unit Default
const getDefaultUnitName = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.unitName;
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
            const cartEl = document.getElementById('cart-items-container-buy');
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
    currentPage.value = 1; // Muat ulang halaman pertama
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
        
        if (isCreditBuy.value) {
            toast.add({ severity: 'info', summary: 'Hutang Dicatat', detail: `Pembelian kredit sebesar ${formatCurrency(grandTotal.value)} berhasil dicatat.`, life: 5000 });
        } else {
             toast.add({ severity: 'success', summary: 'Stok Masuk', detail: 'Data pembelian berhasil disimpan', life: 5000 });
        }
        
        cart.value = [];
        purchaseInfo.supplier = '';
        purchaseInfo.referenceNo = '';
        purchaseInfo.notes = '';
        purchaseInfo.paymentMethod = 'CASH';
        purchaseInfo.dueDate = null;
        currentPage.value = 1; // Reset ke halaman 1
        await loadProducts(); 

    } catch (e) {
        console.error("Error processing purchase:", e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Transaksi gagal diproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    if (qty < 10) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
};

onMounted(async () => {
    await fetchCategories(); 
    await loadProducts();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') document.getElementById('search-input-buy')?.focus();
    });
});

const refreshData = async () => {
    currentPage.value = 1; // Pastikan refresh memuat ulang halaman 1
    await loadProducts();
}
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-500 font-sans">
        <div class="flex-1 flex flex-col bg-surface-0 dark:bg-surface-500 rounded-2xl shadow border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            <div class="p-4 border-b border-surface-100 dark:border-surface-800 flex flex-col gap-3 bg-surface-50/30 dark:bg-surface-500/50">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2.5 text-orange-600 dark:text-orange-400">
                        <div class="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shadow-sm">
                            <i class="pi pi-download text-lg"></i>
                        </div>
                        <div class="flex flex-col">
                            <h2 class="font-black text-sm uppercase tracking-wide leading-none text-surface-800 dark:text-surface-100">Stok Masuk</h2>
                            <span class="text-[10px] text-surface-500 mt-1 font-medium">Pilih produk untuk restock</span>
                        </div>
                    </div>
                    <Button label="Produk Baru" icon="pi pi-plus" size="small" outlined severity="warning" class="!text-[11px] !py-1.5 !px-3 !rounded-lg" @click="showCreateModal = true" />
                </div>
                
                <div class="flex flex-col md:flex-row gap-2">
                    <div class="w-full md:w-48">
                        <MultiSelect 
                            v-model="selectedCategoryUuids" 
                            :options="categories" 
                            optionLabel="name" 
                            optionValue="uuid" 
                            placeholder="Filter Kategori" 
                            display="chip" 
                            :maxSelectedLabels="1" 
                            class="w-full !h-[38px] !text-xs dark:bg-surface-800 !border-orange-200 dark:!border-surface-700"
                            :pt="{ label: { class: '!py-2 !px-3' } }"
                        >
                            <template #option="slotProps">
                                <div class="flex align-items-center text-surface-700 dark:text-surface-200">
                                    <i class="pi pi-tag mr-2 text-orange-500 text-xs"></i>
                                    <span class="text-xs">{{ slotProps.option.name }}</span>
                                </div>
                            </template>
                        </MultiSelect>
                    </div>

                    <div class="relative group flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm group-focus-within:text-orange-500 transition-colors"></i>
                        <input 
                            id="search-input-buy"
                            v-model="searchQuery" 
                            type="text"
                            placeholder="Cari nama produk atau scan barcode... (Enter untuk cari di database, F2)" 
                            class="w-full pl-9 pr-4 py-2.5 text-xs font-medium dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all shadow-sm h-[38px]"
                            @keydown="onSearchKeydown" 
                            @input="handleSearch"
                            autocomplete="off"
                        />
                    </div>
                </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 bg-surface-50 dark:bg-surface-500 scrollbar-thin flex flex-col">
                <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 35px; height: 35px" strokeWidth="4" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 flex-1">
                    <div 
                        v-for="prod in filteredProducts" 
                        :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="group relative dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-[110px] select-none"
                    >
                        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="pi pi-plus-circle text-orange-500 text-lg rounded-full"></i>
                        </div>

                        <div class="flex flex-col h-full justify-between">
                            <div>
                                <div class="font-bold text-xs text-surface-700 dark:text-surface-200 leading-snug line-clamp-2 mb-2 group-hover:text-orange-700 transition-colors">
                                    {{ prod.name }}
                                </div>
                            </div>
                            
                            <div class="flex items-end justify-between">
                                <div class="flex flex-col gap-1 w-full">
                                    <div class="flex items-center justify-between">
                                        <span class="text-[9px] text-surface-400 truncate max-w-[70%]">
                                            {{ categories.find(c => c.uuid === prod.categoryUuids[0])?.name || 'Umum' }}
                                        </span>
                                    </div>

                                    <div class="flex items-center gap-1">
                                        <span class="text-[10px] text-surface-400 font-medium mr-1">Sisa:</span>
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit" 
                                              :class="getStockColor(getDefaultUnitStock(prod))">
                                            {{ getDefaultUnitStock(prod) }} {{ getDefaultUnitName(prod) }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 gap-3 opacity-70 flex-1">
                    <div class="w-16 h-16 bg-surface-200 dark:bg-surface-800 rounded-full flex items-center justify-center">
                         <i class="pi pi-search text-2xl"></i>
                    </div>
                    <span class="text-xs font-medium">Produk tidak ditemukan</span>
                </div>
                
                <div v-if="totalPages > 1 && !loading" class="mt-4 flex justify-between items-center border-t border-surface-200 dark:border-surface-700 pt-3 sticky bottom-0 bg-surface-50 dark:bg-surface-500">
                    <Button 
                        icon="pi pi-chevron-left" 
                        label="Sebelumnya"
                        size="small" 
                        text 
                        :disabled="currentPage === 1"
                        @click="changePage(currentPage - 1)"
                        class="!text-xs"
                    />
                    
                    <span class="text-xs font-medium text-surface-600 dark:text-surface-400">
                        Halaman <span class="font-bold text-orange-600">{{ currentPage }}</span> dari {{ totalPages }}
                        <span class="text-[10px] ml-1">({{ totalProducts }} total)</span>
                    </span>

                    <Button 
                        label="Selanjutnya"
                        icon="pi pi-chevron-right" 
                        iconPos="right"
                        size="small" 
                        text 
                        :disabled="currentPage === totalPages"
                        @click="changePage(currentPage + 1)"
                        class="!text-xs"
                    />
                </div>
            </div>
        </div>

        <div class="w-[380px] flex flex-col bg-surface-0 dark:bg-surface-500 rounded-2xl shadow border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
            <div class="p-3 px-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50 dark:bg-surface-500/50">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ totalItems }}</span>
                    </div>
                    <span class="font-bold text-sm text-surface-700 dark:text-surface-200">Item Masuk</span>
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

            <div id="cart-items-container-buy" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30 dark:bg-surface-500/30">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 dark:text-surface-700 gap-2 opacity-60">
                    <i class="pi pi-inbox text-4xl mb-1"></i>
                    <p class="text-xs font-medium">Belum ada barang dipilih</p>
                </div>

                <div v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" 
                     class="dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3 shadow-sm hover:border-orange-300 dark:hover:border-orange-700 transition-all group relative">
                    
                    <button class="absolute -top-2 -right-2 w-6 h-6 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-full shadow-sm flex items-center justify-center text-surface-400 hover:text-red-500 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 z-10 transform scale-90 group-hover:scale-100" 
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
                            <div class="inline-flex items-center h-7 bg-surface-100 dark:bg-surface-500 rounded-lg px-2 border border-surface-200 dark:border-surface-700 w-fit">
                                <span class="text-[9px] text-surface-400 font-bold uppercase mr-2 tracking-wide">Satuan</span>
                                <Dropdown 
                                    v-model="item.unitUuid" 
                                    :options="item.availableUnits" 
                                    optionLabel="unitName" 
                                    optionValue="uuid" 
                                    class="custom-pill-dropdown !h-5 !border-none !bg-transparent !shadow-none min-w-[60px] !items-center"
                                    :pt="{ 
                                        input: { class: '!p-0 !text-[11px] font-bold text-surface-700 dark:!text-surface-200' }, 
                                        trigger: { class: '!w-4 text-surface-400' }
                                    }"
                                    @change="(e) => changeCartItemUnit(item, e.value)"
                                />
                            </div>

                            <div class="flex items-center border border-surface-200 dark:border-surface-700 rounded-lg dark:bg-surface-500 h-8 px-2 focus-within:ring-1 focus-within:ring-orange-400 focus-within:border-orange-400 transition-all">
                                <span class="text-[10px] font-bold text-surface-400 mr-1">@Rp</span>
                                <InputNumber 
                                    v-model="item.buyPrice" 
                                    mode="currency" currency="IDR" locale="id-ID" 
                                    class="w-full !h-full" 
                                    inputClass="!text-xs !h-full !p-0 !font-mono !font-bold !text-orange-600 dark:!text-orange-400 !bg-transparent !border-none focus:!ring-0"
                                    placeholder="0" :min="0" 
                                />
                            </div>
                        </div>

                        <div class="flex flex-col items-end justify-between h-full gap-2">
                            <div class="flex items-center bg-surface-100 dark:bg-surface-500 rounded-lg border border-surface-200 dark:border-surface-700 h-7 shadow-sm">
                                <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:hover:text-red-500 rounded-l-lg transition-colors" 
                                        @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 text-surface-800 dark:text-surface-100" min="1" />
                                <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:hover:text-primary-600 rounded-r-lg transition-colors" 
                                        @click="item.qty++">
                                    <i class="pi pi-plus text-[9px] font-bold"></i>
                                </button>
                            </div>

                            <div class="text-[11px] font-black text-surface-700 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded border border-surface-200 dark:border-surface-700">
                                {{ formatCurrency(item.buyPrice * item.qty) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 shrink-0">
                <div class="flex justify-between items-end">
                    <span class="text-xs text-surface-500 uppercase font-bold tracking-wider mb-1">Total Estimasi</span>
                    <span class="text-2xl font-black text-surface-900 dark:text-white tracking-tight">{{ formatCurrency(grandTotal) }}</span>
                </div>
            </div>
        </div>

        <div class="w-[320px] flex flex-col bg-surface-0 dark:bg-surface-500 rounded-2xl shadow border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
             <div class="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/30 dark:bg-surface-500/50">
                 <h2 class="font-bold text-sm text-surface-700 dark:text-surface-200 flex items-center gap-2">
                     <div class="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <i class="pi pi-file-edit text-orange-600 dark:text-orange-400 text-xs"></i>
                     </div>
                     Data Dokumen
                 </h2>
             </div>
             
             <div class="p-4 flex-1 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
                 <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Supplier</label>
                     <div class="relative">
                        <i class="pi pi-building text-surface-400 text-xs absolute top-1/2 -translate-y-1/2 left-3"></i>
                        <InputText v-model="purchaseInfo.supplier" placeholder="Nama Supplier / Toko" 
                            class="w-full !pl-9 !py-2.5 !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!border-orange-400 focus:!ring-1 focus:!ring-orange-500/30 focus:!transition-colors" />
                     </div>
                 </div>

                 <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">No. Referensi</label>
                     <div class="relative">
                        <i class="pi pi-hashtag text-surface-400 text-xs absolute top-1/2 -translate-y-1/2 left-3"></i>
                        <InputText v-model="purchaseInfo.referenceNo" placeholder="No. Faktur / Nota" 
                            class="w-full !pl-9 !py-2.5 !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!border-orange-400 focus:!ring-1 focus:!ring-orange-500/30 focus:!transition-colors" />
                     </div>
                 </div>

                <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Metode Bayar</label>
                     <SelectButton v-model="purchaseInfo.paymentMethod" 
                        :options="[{label: 'Cash/Transfer', value: 'CASH'}, {label: 'Kredit (Hutang)', value: 'CREDIT'}]"
                        optionLabel="label" optionValue="value"
                        class="w-full"
                        :pt="{ 
                            button: ({ context }) => ({ 
                                class: [
                                    '!text-xs !py-2', 
                                    context.instance.value === 'CREDIT' 
                                        ? '!bg-red-500/10 !text-red-500 !border-red-500/50' 
                                        : '!bg-emerald-500/10 !text-emerald-500 !border-emerald-500/50',
                                    'dark:!bg-surface-800 dark:!border-surface-700 dark:!text-surface-200'
                                ] 
                            }) 
                        }"
                    />
                 </div>
                 
                 <div v-if="isCreditBuy" class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Jatuh Tempo <span class="text-red-400">*</span></label>
                     <Calendar 
                        v-model="purchaseInfo.dueDate" 
                        dateFormat="dd/mm/yy" 
                        :minDate="new Date()" 
                        :manualInput="false" 
                        showIcon 
                        class="w-full" 
                        inputClass="!text-xs !py-2.5 !h-11 !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!border-orange-400 focus:!ring-1 focus:!ring-orange-500/30" 
                        :class="{ 'p-invalid': isCreditBuy && !purchaseInfo.dueDate && cart.length > 0 }"
                    />
                 </div>


                 <div class="space-y-1 flex-1 flex flex-col">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Catatan</label>
                     <Textarea 
                        v-model="purchaseInfo.notes" 
                        placeholder="Keterangan tambahan..." 
                        class="w-full !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!border-orange-400 focus:!ring-1 focus:!ring-orange-500/30 !p-3 resize-none flex-1" />
                 </div>
             </div>

             <div class="p-4 bg-surface-150 dark:bg-surface-500 relative z-10 border-t border-surface-200 dark:border-surface-800">
                <Button 
                    :label="isCreditBuy ? 'CATAT HUTANG' : 'SIMPAN STOK'" 
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
/* Scrollbar Halus (sesuaikan untuk mode gelap) */
.scrollbar-thin::-webkit-scrollbar { width: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { 
    background: #e5e7eb; /* surface-200 */
    border-radius: 4px; 
}
.dark .scrollbar-thin::-webkit-scrollbar-thumb { 
    background: #374151; /* surface-700 */
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #4b5563; }

/* Override PrimeVue Dropdown agar rapih */
:deep(.custom-pill-dropdown .p-dropdown-label) {
    padding: 0 !important;
    display: flex;
    align-items: center;
    white-space: nowrap;
}
</style>