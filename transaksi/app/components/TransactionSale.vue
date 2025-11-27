// components/TransactionSale.vue

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProductCreateModal from '~/components/ProductCreateModal.vue';
import { useAuthStore } from '~/stores/auth.store';

const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService();
const authStore = useAuthStore();
const toast = useToast();

// --- STATE PAGINATION & PRODUCT ---
const products = ref([]); // Data produk yang telah dimuat (akumulasi dari Load More)
const filteredProducts = ref([]); // Produk yang ditampilkan setelah filter kategori lokal/search
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);
const showCreateModal = ref(false);

const categories = ref([]); 
const selectedCategoryUuids = ref([]); 

// [BARU] State Paginasi
const currentPage = ref(1);
const limit = 30; // Batas item per halaman (dapat disesuaikan)
const totalPages = ref(1);
const totalProducts = ref(0);
const moreLoading = ref(false);

const payment = reactive({
    method: 'CASH', // [BARU] Tambah metode pembayaran
    amount: null,
    customerName: '', // [BARU] Nama pelanggan untuk piutang
    dueDate: null, // [BARU] Tanggal jatuh tempo
});

// --- COMPUTED SETTINGS ---
const taxEnabled = computed(() => authStore.getSetting('sale_tax_enabled', false));
const taxRate = computed(() => Number(authStore.getSetting('sale_tax_percentage', 0)));
const taxMethod = computed(() => authStore.getSetting('sale_tax_method', 'exclusive'));

// --- COMPUTED TRANSACTION LOGIC ---
const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));
const cartSubtotal = computed(() => cart.value.reduce((total, item) => total + (item.price * item.qty), 0));
const taxAmount = computed(() => {
    if (!taxEnabled.value || taxRate.value <= 0) return 0;
    return taxMethod.value === 'exclusive' 
        ? cartSubtotal.value * (taxRate.value / 100)
        : cartSubtotal.value - (cartSubtotal.value / (1 + (taxRate.value / 100)));
});
const grandTotal = computed(() => {
    if (!taxEnabled.value) return cartSubtotal.value;
    return taxMethod.value === 'exclusive' ? cartSubtotal.value + taxAmount.value : cartSubtotal.value;
});

const isCreditSale = computed(() => payment.method === 'CREDIT'); // [BARU] Check credit sale
const amountPaid = computed(() => isCreditSale.value ? 0 : (payment.amount || 0)); // [UPDATE] Jika kredit, jumlah dibayar 0

const changeAmount = computed(() => amountPaid.value - grandTotal.value);

const canCheckout = computed(() => {
    if (cart.value.length === 0) return false;
    
    // [UPDATE] Logika Checkout:
    if (isCreditSale.value) {
        // Jika Kredit: Hanya perlu GrandTotal > 0, Nama Pelanggan diisi, dan Tanggal Jatuh Tempo
        return grandTotal.value > 0 && !!payment.customerName && !!payment.dueDate;
    } else {
        // Jika Cash/Non-Kredit: Perlu Uang Diterima >= Total
        return amountPaid.value >= grandTotal.value;
    }
});

// --- ACTIONS ---

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        // [UPDATE PAGINASI] Tekan Enter untuk memicu pencarian ke API (reset halaman)
        currentPage.value = 1;
        loadProducts(); 
    }
};

const fetchCategories = async () => {
    try {
        const data = await categoryService.getAllCategorys();
        categories.value = data || [];
    } catch (e) { console.error(e); }
};

const loadProducts = async (isLoadMore = false) => {
    if (!isLoadMore) {
        loading.value = true;
        // Kosongkan produk hanya jika halaman baru (bukan load more)
        if (currentPage.value === 1) products.value = []; 
    } else {
        moreLoading.value = true;
    }

    try {
        // [PERBAIKAN PAGINASI] Panggil API dengan paginasi dan query pencarian
        const currentQuery = searchQuery.value.toLowerCase().trim();
        const response = await productService.getAllProducts(currentPage.value, limit, currentQuery);
        
        // Asumsi response API: { data: Product[], meta: { total_page: number, total: number } }
        const productsArray = response?.data || [];
        
        const newProducts = productsArray.map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
            categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean)
        }));
        
        if (isLoadMore) {
            products.value.push(...newProducts); // Tambahkan untuk Load More
        } else {
            products.value = newProducts; // Ganti dengan data halaman baru
        }

        // Update metadata paginasi
        totalPages.value = response?.meta?.total_page || 1;
        totalProducts.value = response?.meta?.total || 0;
        
        handleLocalFiltering(); // Filter kategori setelah data dimuat (jika ada)

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat produk', life: 3000 });
    } finally {
        loading.value = false;
        moreLoading.value = false;
    }
};

const loadMoreProducts = () => {
    if (currentPage.value < totalPages.value) {
        currentPage.value++;
        loadProducts(true);
    }
};


const handleLocalFiltering = () => {
    const selectedCats = selectedCategoryUuids.value;
    let result = products.value;

    // 1. FILTER KATEGORI LOKAL (HANYA DARI PRODUK YANG SUDAH DIMUAT)
    if (selectedCats.length > 0) {
        result = result.filter(p => {
            return p.categoryUuids.some(catUuid => selectedCats.includes(catUuid));
        });
    }

    // 2. SCAN BARCODE INSTANT & LOCAL TEXT FILTERING
    const query = searchQuery.value.toLowerCase().trim();
    if (query) {
        // Pengecekan Barcode untuk Add to Cart Instan
        const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));
        if (exactProduct) {
            const matchedUnit = exactProduct.units.find(u => u.barcode === query);
            addToCart(exactProduct, matchedUnit);
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name}`, life: 1500 });
            return; 
        }
        
        // Filter Teks Lokal untuk efek mengetik sebelum user menekan Enter (kecuali jika ada filter kategori, yang harus didahulukan)
        // Jika user mengetik, kita hanya memfilter produk yang sudah ada di memori/layar.
        result = result.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.units.some(u => u.barcode?.includes(query))
        );
    }

    filteredProducts.value = result;
};


// [UPDATE] Ketika kategori berubah, reset halaman dan muat ulang produk dari API
watch(selectedCategoryUuids, () => {
    currentPage.value = 1;
    loadProducts();
});

// [UPDATE] Ketika input pencarian berubah, lakukan filter lokal untuk efek instan/barcode.
// Pencarian ke DB hanya dilakukan saat Enter ditekan (di onSearchKeydown).
watch(searchQuery, () => {
    handleLocalFiltering();
});


const addToCart = (product, specificUnit = null) => {
    let selectedUnit = specificUnit;
    if (!selectedUnit) {
        selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    }
    if (!selectedUnit) {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk error (tanpa satuan)', life: 3000 });
        return;
    }
    const unitPrices = product.prices.filter(p => p.unitUuid === selectedUnit.uuid);
    const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    const finalPrice = defaultPriceObj ? defaultPriceObj.price : 0;

    const existingItem = cart.value.find(item => item.productUuid === product.uuid && item.unitUuid === selectedUnit.uuid);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.value.push({
            productUuid: product.uuid,
            name: product.name,
            unitUuid: selectedUnit.uuid,
            unitName: selectedUnit.unitName,
            price: finalPrice, 
            qty: 1,
            selectedPriceObj: defaultPriceObj, 
            availableUnits: product.units,
            allPrices: product.prices 
        });
    }
    setTimeout(() => {
        const cartEl = document.getElementById('cart-items-container');
        if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
    }, 50);
};

const changeCartItemUnit = (item, newUnitUuid) => {
    const newUnit = item.availableUnits.find(u => u.uuid === newUnitUuid);
    if (!newUnit) return;
    item.unitUuid = newUnit.uuid;
    item.unitName = newUnit.unitName;
    const unitPrices = item.allPrices.filter(p => p.unitUuid === newUnit.uuid);
    const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    item.selectedPriceObj = defaultPriceObj;
    item.price = defaultPriceObj ? defaultPriceObj.price : 0;
};

const changeCartItemPriceTier = (item, newPriceObj) => {
    item.selectedPriceObj = newPriceObj;
    item.price = newPriceObj.price;
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const onProductCreated = async (newProduct) => {
    currentPage.value = 1; // [UPDATE] Reset page saat produk baru dibuat
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) addToCart(fullProduct);
};

const processCheckout = async () => {
    if (!canCheckout.value) return;
    processing.value = true;
    try {
        const payload = {
            amount: grandTotal.value,
            details: {
                payment_method: payment.method, // [UPDATE] Kirim payment.method
                // [UPDATE] Conditional fields untuk Kredit/Cash
                ...(isCreditSale.value ? {
                    is_credit: 'true', // Marker untuk backend JournalService
                    due_date: payment.dueDate,
                    customer_name: payment.customerName,
                    payment_received: 0, 
                    change: 0,
                } : {
                    is_credit: 'false',
                    payment_received: payment.amount,
                    change: changeAmount.value,
                }),
                
                total_items_count: cart.value.length,
                subtotal_amount: cartSubtotal.value,
                tax_amount: taxAmount.value,
                tax_percentage: taxEnabled.value ? taxRate.value : 0,
                tax_method: taxEnabled.value ? taxMethod.value : null,
                grand_total: grandTotal.value
            }
        };
        cart.value.forEach((item, index) => {
            payload.details[`product_uuid#${index}`] = item.productUuid;
            payload.details[`unit_uuid#${index}`] = item.unitUuid;
            payload.details[`qty#${index}`] = item.qty;
            payload.details[`price#${index}`] = item.price;
            payload.details[`subtotal#${index}`] = item.qty * item.price;
        });
        
        await journalService.createSaleTransaction(payload);
        
        // Pesan Sukses disesuaikan
        if (isCreditSale.value) {
             toast.add({ severity: 'info', summary: 'Piutang Dicatat', detail: `Penjualan kredit ke ${payment.customerName} sebesar ${formatCurrency(grandTotal.value)}`, life: 5000 });
        } else {
             toast.add({ severity: 'success', summary: 'Transaksi Sukses', detail: 'Kembalian: ' + formatCurrency(changeAmount.value), life: 5000 });
        }
        
        // Reset state
        cart.value = [];
        payment.amount = null;
        payment.method = 'CASH'; // [UPDATE] Reset metode pembayaran
        payment.customerName = ''; // [UPDATE] Reset field kredit
        payment.dueDate = null; // [UPDATE] Reset field kredit
        currentPage.value = 1; // [UPDATE] Reset page
        await loadProducts(); 
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat memproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const getDefaultUnitStock = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.currentStock || 0; 
};

const getDefaultUnitName = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.unitName;
};

// FIX: Menambahkan kelas dark mode ke helper stok
const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    if (qty < 10) return 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    return 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
};

onMounted(async () => {
    await fetchCategories(); 
    await loadProducts();
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') document.getElementById('search-input-sale')?.focus();
    });
});

// [BARU] Expose fungsi refresh agar bisa dipanggil dari parent (TransactionIndex.vue)
const refreshData = async () => {
    currentPage.value = 1; // [UPDATE] Reset page saat refresh
    await loadProducts();
}
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-950 font-sans">
        
        <div class="flex-1 flex flex-col dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            <div class="p-3 border-b border-surface-100 dark:border-surface-800 flex flex-col md:flex-row gap-2 bg-surface-50/50 dark:bg-surface-950/50">
                
                <div class="w-full md:w-48">
                    <MultiSelect 
                        v-model="selectedCategoryUuids" 
                        :options="categories" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Filter Kategori" 
                        display="chip" 
                        :maxSelectedLabels="1" 
                        class="w-full !h-10 !text-sm dark:bg-surface-800 border border-surface-200 dark:border-surface-700 "
                        :pt="{ label: { class: '!py-2 !px-3' } }"
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center text-surface-700 dark:text-surface-200">
                                <i class="pi pi-tag mr-2 text-orange-500 text-xs"></i>
                                <span class="text-sm">{{ slotProps.option.name }}</span>
                            </div>
                        </template>
                    </MultiSelect>
                </div>

                <div class="relative flex-1">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 text-sm"></i>
                    <input 
                        id="search-input-sale"
                        v-model="searchQuery" 
                        type="text"
                        placeholder="Cari Produk / Scan Barcode... (Enter untuk cari di database F2)" 
                        class="w-full pl-9 pr-3 py-2 text-sm dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all shadow-sm h-10"
                        @keydown="onSearchKeydown" 
                        @input="handleLocalFiltering"
                        autocomplete="off"
                    />
                </div>
                <Button icon="pi pi-plus" class="!w-10 !h-10 !rounded-lg" severity="primary" outlined v-tooltip.bottom="'Produk Baru'" @click="$emit('open-create-modal')" />
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 dark:bg-surface-950 scrollbar-thin">
                <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 40px; height: 40px" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                    <div v-for="prod in filteredProducts" :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="group relative dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 cursor-pointer hover:border-primary-400 hover:shadow-md transition-all active:scale-95 select-none flex flex-col justify-between h-28"
                    >
                        <div>
                            <div class="text-xs font-bold text-surface-700 dark:text-surface-200 line-clamp-2 mb-1 leading-snug group-hover:text-primary-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <div class="flex gap-1 mt-1">
                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(getDefaultUnitStock(prod))">
                                    Stok: {{ getDefaultUnitStock(prod) }}
                                </span>
                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-600">
                                    {{ getDefaultUnitName(prod) }}
                                </span>
                            </div>
                        </div>
                        
                        <div class="flex justify-between items-end mt-2">
                            <span class="text-[9px] text-surface-400 truncate max-w-[50%]">
                                {{ categories.find(c => c.uuid === prod.categoryUuids[0])?.name || 'Umum' }}
                            </span>
                            <span class="text-sm font-black text-surface-800 dark:text-white">
                                {{ (() => {
                                    const defUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
                                    const defPrice = prod.prices?.find(p => p.unitUuid === defUnit?.uuid && (p.isDefault || p.name === 'Umum')) || prod.prices?.[0];
                                    return formatCurrency(defPrice?.price || 0);
                                })() }}
                            </span>
                        </div>
                    </div>
                </div>

                <div v-else class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-600 gap-2 opacity-60">
                    <i class="pi pi-box text-4xl"></i>
                    <span class="text-xs">Produk tidak ditemukan</span>
                </div>

                <div v-if="currentPage < totalPages && filteredProducts.length > 0" class="mt-4 text-center">
                    <Button 
                        :label="moreLoading ? 'Memuat...' : `Tampilkan Lebih Banyak (${products.length}/${totalProducts})`" 
                        icon="pi pi-arrow-down" 
                        size="small"
                        outlined
                        :loading="moreLoading"
                        @click="loadMoreProducts"
                        class="!text-xs !py-2 !px-4"
                    />
                </div>
                </div>
        </div>

        <div class="w-[380px] flex flex-col dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-950/50 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ totalItems }}</span>
                    </div>
                    <span class="font-bold text-sm text-surface-700 dark:text-surface-200">Keranjang</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30 dark:bg-surface-950/30">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 dark:text-surface-700 gap-3">
                    <div class="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                        <i class="pi pi-shopping-cart text-2xl opacity-40"></i>
                    </div>
                    <p class="text-xs">Belum ada item</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" 
                     class="group dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-2.5 hover:border-primary-300 dark:hover:border-primary-600 transition-all shadow-sm relative">
                    
                    <button class="absolute -top-2 -right-2 dark:bg-surface-900 shadow border border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500 hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>

                    <div class="mb-2 pr-4">
                        <div class="text-sm font-bold text-surface-800 dark:text-surface-100 line-clamp-1" :title="item.name">{{ item.name }}</div>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                        <div class="flex flex-col gap-2 flex-1">
                             <div class="flex gap-2">
                                <Dropdown 
                                    v-model="item.unitUuid" 
                                    :options="item.availableUnits" 
                                    optionLabel="unitName" 
                                    optionValue="uuid" 
                                    class="custom-tiny-dropdown !h-7 !w-20 !bg-surface-50 dark:!bg-surface-700 !border-surface-200 dark:!border-surface-600 !shadow-none !rounded-lg !flex !items-center"
                                    :pt="{ 
                                        input: { class: '!py-0 !px-2 !text-[10px] !font-bold !text-surface-700 dark:!text-surface-200' }, 
                                        trigger: { class: '!w-5 !text-surface-400' },
                                        panel: { class: '!text-xs' },
                                        item: { class: '!py-1.5 !px-3 !text-xs' }
                                    }"
                                    @change="(e) => changeCartItemUnit(item, e.value)" 
                                />
                                
                                <Dropdown 
                                    v-model="item.selectedPriceObj" 
                                    :options="item.allPrices.filter(p => p.unitUuid === item.unitUuid)" 
                                    optionLabel="name" 
                                    class="custom-tiny-dropdown !h-7 flex-1 !bg-surface-50 dark:!bg-surface-700 !border-surface-200 dark:!border-surface-600 !shadow-none !rounded-lg !flex !items-center"
                                    placeholder="Custom" 
                                    :pt="{ 
                                        input: { class: '!py-0 !px-2 !text-[10px] !font-medium !text-surface-700 dark:!text-surface-200' }, 
                                        trigger: { class: '!w-5 !text-surface-400' },
                                        panel: { class: '!text-xs' },
                                        item: { class: '!py-1.5 !px-3 !text-xs' }
                                    }"
                                    @change="(e) => changeCartItemPriceTier(item, e.value)" 
                                />
                            </div>

                            <InputNumber 
                                v-model="item.price" 
                                mode="currency" currency="IDR" locale="id-ID" 
                                class="!h-7 w-full" 
                                inputClass="!text-xs !h-7 !py-0 !px-2 !font-mono !text-right !rounded-lg !bg-surface-50 dark:!bg-surface-700 !border-surface-200 dark:!border-surface-600 focus:!border-primary-500 focus:!ring-1"
                                :min="0" 
                                @input="item.selectedPriceObj = null" 
                            />
                        </div>

                        <div class="flex flex-col items-end gap-1.5">
                            <div class="flex items-center bg-surface-100 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-600 h-7">
                                <button class="w-7 h-full flex items-center justify-center hover:dark:hover:bg-surface-800 rounded-l-lg transition text-surface-600 dark:text-surface-400 hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 text-surface-800 dark:text-surface-100" min="1" />
                                <button class="w-7 h-full flex items-center justify-center hover:dark:hover:bg-surface-800 rounded-r-lg transition text-primary-600" @click="item.qty++">
                                    <i class="pi pi-plus text-[9px] font-bold"></i>
                                </button>
                            </div>
                            <div class="text-xs font-black text-surface-800 dark:text-surface-100 bg-surface-50 dark:bg-surface-700 px-2 py-1 rounded border border-surface-200 dark:border-surface-600">
                                {{ formatCurrency(item.price * item.qty) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-3 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 space-y-2">
                
                <div v-if="taxEnabled" class="space-y-1 border-b border-dashed border-surface-300 dark:border-surface-600 pb-2 mb-2">
                    <div class="flex justify-between items-center text-xs text-surface-500 dark:text-surface-400">
                        <span>Subtotal</span>
                        <span>{{ formatCurrency(cartSubtotal) }}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs text-surface-500 dark:text-surface-400">
                        <span>
                            Pajak ({{ taxRate }}%) 
                            <span v-if="taxMethod === 'inclusive'" class="text-[9px] bg-surface-200 dark:bg-surface-700 px-1 rounded ml-1">Include</span>
                        </span>
                        <span>{{ formatCurrency(taxAmount) }}</span>
                    </div>
                </div>

                <div class="flex justify-between items-end">
                    <span class="text-xs text-surface-500 dark:text-surface-400 uppercase font-bold tracking-wider mb-1">Total Tagihan</span>
                    <span class="text-xl font-black text-primary-600 dark:text-primary-400">{{ formatCurrency(grandTotal) }}</span>
                </div>
            </div>
        </div>

        <div class="w-[320px] flex flex-col rounded-xl shadow-lg border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0 relative">
             <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
             
             <div class="p-4 flex-1 flex flex-col gap-5 relative z-10 overflow-y-auto scrollbar-thin">
                <div class="text-center pt-2">
                    <h3 class="text-surface-400 text-xs uppercase tracking-widest font-bold mb-1">Total Harus Dibayar</h3>
                    <div class="text-3xl font-black tracking-tight">
                        {{ formatCurrency(grandTotal) }}
                    </div>
                </div>

                <div class="bg-surface-800/50 p-3 rounded-xl border border-surface-700/50">
                    <label class="text-[10px] text-surface-400 uppercase font-bold mb-2 block">Metode Pembayaran</label>
                    <SelectButton 
                        v-model="payment.method" 
                        :options="[{label: 'Cash', value: 'CASH'}, {label: 'Kredit (Piutang)', value: 'CREDIT'}]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        :pt="{ button: { class: '!text-xs !py-2' } }"
                    />
                </div>

                <div v-if="!isCreditSale" class="bg-surface-800/50 p-3 rounded-xl border border-surface-700/50">
                    <label class="text-[10px] text-surface-400 uppercase font-bold mb-2 block">Uang Diterima (Cash)</label>
                    <InputNumber v-model="payment.amount" mode="currency" currency="IDR" locale="id-ID" 
                        class="w-full" placeholder="0" :min="0" autofocus inputClass="!text-base !py-2.5 !px-3 !font-mono !rounded-lg !border-surface-700 focus:!border-primary-500 focus:!ring-1 !h-11" />
                    
                    <div class="grid grid-cols-2 gap-2 mt-2">
                         <button class="py-1.5 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = grandTotal">Uang Pas</button>
                         <button class="py-1.5 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = 50000">50.000</button>
                         <button class="py-1.5 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = 100000">100.000</button>
                         <button class="py-1.5 bg-red-900/40 text-red-300 hover:bg-red-900/60 rounded text-[10px] font-bold transition-colors border border-red-900/50" @click="payment.amount = null">Clear</button>
                    </div>
                </div>
                
                <div v-else class="bg-surface-800/50 p-3 rounded-xl border border-surface-700/50 space-y-4">
                     <div class="space-y-1">
                        <label class="text-[10px] text-surface-400 uppercase font-bold mb-2 block">Nama Pelanggan <span class="text-red-400">*</span></label>
                        <InputText v-model="payment.customerName" placeholder="Nama Pelanggan" 
                            class="w-full !py-2.5 !text-xs !rounded-lg !border-surface-700 focus:!border-primary-500 focus:!ring-1 !h-11" />
                    </div>
                     <div class="space-y-1">
                        <label class="text-[10px] text-surface-400 uppercase font-bold mb-2 block">Jatuh Tempo <span class="text-red-400">*</span></label>
                        <Calendar v-model="payment.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" :manualInput="false" showIcon class="w-full" inputClass="!text-xs !py-2.5 !h-11" />
                    </div>
                </div>


                <div class="flex-1 flex flex-col justify-center items-center border-t border-surface-800 border-dashed pt-2">
                    <span class="text-xs text-surface-400 mb-1">{{ isCreditSale ? 'Sisa Hutang' : 'Kembalian' }}</span>
                    <span class="text-2xl font-mono font-bold" :class="changeAmount < 0 ? 'text-red-400' : 'text-emerald-400'">
                        {{ formatCurrency(isCreditSale ? grandTotal : Math.max(0, changeAmount)) }}
                    </span>
                    <div v-if="!isCreditSale && changeAmount < 0" class="text-[10px] text-red-400 mt-1 bg-red-900/30 px-2 py-0.5 rounded">Kurang {{ formatCurrency(Math.abs(changeAmount)) }}</div>
                    <div v-else-if="isCreditSale && canCheckout" class="text-[10px] text-blue-400 mt-1 bg-blue-900/30 px-2 py-0.5 rounded">Piutang akan dicatat</div>
                </div>
             </div>

             <div class="p-4 relative z-10">
                <Button :label="isCreditSale ? 'CATAT PIUTANG' : 'PROSES BAYAR'" icon="pi pi-print" 
                    class="w-full font-black !py-3 !text-sm !bg-emerald-500 hover:!bg-emerald-600 !border-none !text-white shadow-lg shadow-emerald-900/50 active:translate-y-0.5 transition-all" 
                    :disabled="!canCheckout" :loading="processing" @click="processCheckout" size="large" />
             </div>
        </div>

        <ProductCreateModal v-model:visible="showCreateModal" @product-created="onProductCreated" />
    </div>
</template>

<style scoped>
/* Custom Scrollbar Halus */
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Override PrimeVue styling specifically for these dropdowns */
:deep(.custom-tiny-dropdown .p-dropdown-label) {
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>