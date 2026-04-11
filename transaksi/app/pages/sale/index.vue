<script setup>
import { ref, computed, onMounted, reactive, nextTick, defineAsyncComponent, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useProductService } from '~/composables/useProductService';
import { useJournalService } from '~/composables/useJournalService';
import { useCategoryService } from '~/composables/useCategoryService';
import { useBrandService } from '~/composables/useBrandService'; 
import { useMemberService } from '~/composables/useMemberService'; 
import { useShelveService } from '~/composables/useShelveService';
import { useUserService } from '~/composables/useUserService';

// --- COMPONENT IMPORTS ---
const ProductCreateModal = defineAsyncComponent(() => import('~/components/product/ProductCreateModal.vue'));

// --- SERVICES ---
const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService();
const brandService = useBrandService(); 
const memberService = useMemberService(); 
const shelveService = useShelveService(); 
const userService = useUserService();
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
const isScanMode = ref(false); 

// --- MODAL STATES ---
const showPaymentModal = ref(false);
const showCreateProductModal = ref(false);
const showVariantModal = ref(false);
const selectedProductForVariant = ref(null);

// --- VIEW STATE ---
const viewMode = ref('grid'); 
const gridColumns = ref(4); 
const categories = ref([]); 
const selectedCategoryUuids = ref([]);
const brands = ref([]); 
const selectedBrandUuids = ref([]); 

// --- DATA MASTER ---
const members = ref([]); 
const shelves = ref([]); 
const users = ref([]); 

// --- STATE TRANSAKSI ---
const transactionMeta = reactive({
    transactionDate: new Date(),
    cashierUuid: authStore.user?.uuid || null,
    memberUuid: null,
    customerName: '', 
    paymentMethod: 'CASH',
    dueDate: null,
    // [BARU] State untuk nomor faktur manual
    manualInvoiceCode: ''
});

const cashAmount = ref(0); 

// --- PAGINATION ---
const currentPage = ref(1);
const limit = 12;
const totalPages = ref(1);
const totalProducts = ref(0);

// --- COMPUTED ---
// Pajak Global Setting
const taxMethod = computed(() => authStore.getSetting('sale_tax_method', 'exclusive'));

// [BARU] Computed untuk pengaturan tipe Faktur
const invoiceType = computed(() => authStore.getSetting('invoice_number_type', 'system'));
const isManualInvoice = computed(() => invoiceType.value === 'manual');

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));
const cartSubtotal = computed(() => cart.value.reduce((total, item) => total + (item.price * item.qty), 0));

// Kalkulasi PPN berdasarkan Produk individual
const taxAmount = computed(() => {
    return cart.value.reduce((totalTax, item) => {
        if (!item.saleTaxPercentage || item.saleTaxPercentage <= 0) return totalTax;
        const itemSubtotal = item.price * item.qty;
        const tax = taxMethod.value === 'exclusive' 
            ? itemSubtotal * (item.saleTaxPercentage / 100)
            : itemSubtotal - (itemSubtotal / (1 + (item.saleTaxPercentage / 100)));
        return totalTax + tax;
    }, 0);
});

const grandTotal = computed(() => {
    return taxMethod.value === 'exclusive' ? cartSubtotal.value + taxAmount.value : cartSubtotal.value;
});

const gridContainerClass = computed(() => {
    if (viewMode.value === 'list') return 'flex flex-col gap-2';
    switch (gridColumns.value) {
        case 2: return 'grid grid-cols-2 gap-3';
        case 3: return 'grid grid-cols-2 md:grid-cols-3 gap-3';
        case 5: return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';
        default: return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3'; 
    }
});

// --- LOGIKA PEMBAYARAN ---
const isCreditSale = computed(() => transactionMeta.paymentMethod === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditSale.value) return 0;
    return cashAmount.value - grandTotal.value;
});

const canCheckout = computed(() => {
    if (cart.value.length === 0) return false;
    if (!transactionMeta.cashierUuid) return false;
    if (processing.value) return false;
    
    // [BARU] Validasi nomor faktur manual tidak boleh kosong jika tipenya manual
    if (isManualInvoice.value && !transactionMeta.manualInvoiceCode.trim()) return false;

    if (isCreditSale.value) {
        const hasCustomer = transactionMeta.memberUuid || transactionMeta.customerName.trim() !== '';
        return hasCustomer && transactionMeta.dueDate;
    } else {
        return cashAmount.value >= grandTotal.value;
    }
});

// --- ACTIONS & FORMATTERS ---
const resetState = () => {
    cashAmount.value = 0;
    transactionMeta.memberUuid = null;
    transactionMeta.customerName = '';
    transactionMeta.paymentMethod = 'CASH';
    transactionMeta.dueDate = null;
    transactionMeta.transactionDate = new Date();
    transactionMeta.cashierUuid = authStore.user?.uuid || null;
    transactionMeta.manualInvoiceCode = ''; // [BARU] Reset manual code
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const getBasePrice = (prod) => {
    var pricesArray = prod.prices ?? [];
    if (!pricesArray || pricesArray.length === 0) return 0;
    const nonGrosir = pricesArray.find(p => !p.name?.toLowerCase().includes('grosir') && !p.name?.toLowerCase().includes('member'));
    return nonGrosir ? nonGrosir.price : pricesArray[0].price;
};

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
    const input = document.getElementById('search-input-sale');
    if (input) input.focus();
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

const processBarcodeScan = async () => {
    if (!searchQuery.value.trim()) return;
    const code = searchQuery.value.trim();
    
    try {
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
        if (isScanMode.value) {
             nextTick(() => focusScanner());
        }
    }
};

const onSearchKeydown = async () => { 
    if (isScanMode.value) {
        await processBarcodeScan();
    } else {
        currentPage.value = 1; 
        loadProducts(); 
    }
};

const recalculateItemPrice = (item) => {
    if (item.isCustomPrice) return;
    const allPrices = item.allPrices || [];
    if (allPrices.length === 0) return;

    const baseName = item.basePriceObj?.name?.toLowerCase() || '';
    let matchingGrosir = null;
    if (baseName.includes('member')) {
        matchingGrosir = allPrices.find(p => p.name.toLowerCase().includes('grosir') && p.name.toLowerCase().includes('member') && p.minQty > 1);
    } else {
        matchingGrosir = allPrices.find(p => p.name.toLowerCase().includes('grosir') && !p.name.toLowerCase().includes('member') && p.minQty > 1);
    }

    if (matchingGrosir && item.qty >= Number(matchingGrosir.minQty)) {
        item.price = Number(matchingGrosir.price);
        item.activeTierName = matchingGrosir.name;
        item.isGrosirActive = true;
    } else {
        item.price = Number(item.basePriceObj?.price || 0);
        item.activeTierName = item.basePriceObj?.name || 'Umum';
        item.isGrosirActive = false;
    }
};

watch(() => authStore.user, (newVal) => {
    if (newVal && newVal.uuid) {
        transactionMeta.cashierUuid = newVal.uuid;
    }
}, { immediate: true, deep: true });

watch(() => transactionMeta.memberUuid, (newMemberUuid) => {
    cart.value.forEach(item => {
        if (item.isCustomPrice) return;
        if (newMemberUuid) {
            const memberTier = item.selectableTiers.find(p => p.name?.toLowerCase().includes('member'));
            if (memberTier && item.basePriceObj?.uuid !== memberTier.uuid) {
                item.basePriceObj = memberTier;
            }
        } else {
            const umumTier = item.selectableTiers.find(p => p.name?.toLowerCase().includes('umum') || p.name?.toLowerCase().includes('normal')) || item.selectableTiers[0];
            if (umumTier && item.basePriceObj?.uuid !== umumTier.uuid) {
                item.basePriceObj = umumTier;
            }
        }
        recalculateItemPrice(item);
    });
    
    if (!isCreditSale.value) {
        nextTick(() => { cashAmount.value = grandTotal.value; });
    }
});

watch(() => transactionMeta.paymentMethod, (newMethod) => {
    if (newMethod === 'CASH') {
        cashAmount.value = grandTotal.value;
    } else {
        cashAmount.value = 0; 
    }
});

// --- CART LOGIC ---
const addToCart = (prod) => {
    if (prod.variants && prod.variants.length > 0) {
        selectedProductForVariant.value = prod;
        showVariantModal.value = true;
    } else {
        pushToCart(prod, null);
    }
};

const pushToCart = (prod, variant) => {
    const variantUuid = variant ? variant.uuid : null;
    const item = cart.value.find(i => i.productUuid === prod.uuid && i.variantUuid === variantUuid);

    if (item) {
        item.qty++;
        recalculateItemPrice(item);
    } else {
        const availablePrices = variant ? (variant.prices || []) : (prod.prices || []);
        const unitName = prod.unit?.name || 'Unit';
        const itemName = variant ? `${prod.name} - ${variant.name}` : prod.name;

        const selectableTiers = availablePrices.filter(p => !p.name.toLowerCase().includes('grosir'));
        selectableTiers.push({ uuid: 'custom', name: 'Harga Custom', price: 0, isCustom: true });
        const defaultBase = selectableTiers.find(p => p.name?.toLowerCase().includes('umum') || p.name?.toLowerCase().includes('normal')) || selectableTiers[0];

        let defaultShelve = null;
        if (prod.shelves && prod.shelves.length > 0) defaultShelve = prod.shelves[0].uuid; 
        else if (shelves.value.length > 0) defaultShelve = shelves.value[0].uuid; 

        const newItem = {
            productUuid: prod.uuid,
            variantUuid: variantUuid,
            name: itemName,
            unitUuid: prod.unitUuid,
            unitName: unitName,
            price: 0,
            qty: 1,
            basePriceObj: defaultBase,
            isCustomPrice: false,
            activeTierName: '',
            isGrosirActive: false,
            selectableTiers: selectableTiers,
            allPrices: availablePrices,
            shelveUuid: defaultShelve,
            expanded: false,
            hppMethod: prod.hppMethod || 'FIFO',
            saleTaxPercentage: Number(prod.saleTaxPercentage || 0)
        };

        recalculateItemPrice(newItem); 
        cart.value.push(newItem);
    }

    showVariantModal.value = false;
    selectedProductForVariant.value = null;
    nextTick(() => { const el = document.getElementById('cart-items-container'); if(el) el.scrollTop = el.scrollHeight; });
};

const changeItemQty = (item, change) => {
    if (change === -1 && item.qty <= 1) return; 
    item.qty += change;
    recalculateItemPrice(item); 
};

const changeCartItemPriceTier = (item, newBaseObj) => { 
    if (!newBaseObj) return;
    item.basePriceObj = newBaseObj;
    
    if (newBaseObj.isCustom) {
        item.isCustomPrice = true;
        item.isGrosirActive = false;
        item.activeTierName = 'Custom Manual';
    } else {
        item.isCustomPrice = false;
        recalculateItemPrice(item);
    }
};

const removeFromCart = (index) => { cart.value.splice(index, 1); };

// --- PAYMENTS & CHECKOUT ---

// Ganti fungsi lama dengan ini:
const generateInvoiceNumber = () => {
    const type = invoiceType.value;
    if (type === 'system' || type === 'manual') return null;

    // Pastikan fallback nilai string yang aman
    const prefix = String(authStore.getSetting('invoice_prefix') || 'INV-').toUpperCase();
    const suffix = String(authStore.getSetting('invoice_suffix') || '').toUpperCase();
    const length = Number(authStore.getSetting('invoice_length')) || 5;
    let randomPart = '';

    if (type === 'numeric') {
        // Generate pseudo-urutan pakai timestamp 
        randomPart = String(new Date().getTime()).slice(-length);
    } else if (type === 'alphanumeric') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let i = 0; i < length; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    
    return `${prefix}${randomPart}${suffix}`;
};

const openPaymentModal = () => {
    if (cart.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Keranjang Kosong', detail: 'Pilih produk dulu', life: 2000 });
        return;
    }
    if (!transactionMeta.cashierUuid) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih Kasir Transaksi terlebih dahulu', life: 2000 });
        return;
    }
    
    if (transactionMeta.memberUuid) {
        cart.value.forEach(item => recalculateItemPrice(item));
    }
    
    if (transactionMeta.paymentMethod === 'CASH') {
        cashAmount.value = grandTotal.value; 
    }

    // Auto-generate invoice number jika custom generator
    if (!isManualInvoice.value && invoiceType.value !== 'system') {
        transactionMeta.manualInvoiceCode = generateInvoiceNumber();
    }
    
    showPaymentModal.value = true;
};

const processCheckout = async (isPrint = false) => {
    if (!canCheckout.value) return;
    processing.value = true;

    try {
        let finalCustName = 'Umum';
        if (transactionMeta.memberUuid) {
            finalCustName = members.value.find(m => m.uuid === transactionMeta.memberUuid)?.name || 'Member';
        } else if (transactionMeta.customerName) {
            finalCustName = transactionMeta.customerName;
        }

        const itemsPayload = cart.value.map(item => ({
            product_uuid: item.productUuid,
            variant_uuid: item.variantUuid || null, 
            unit_uuid: item.unitUuid,
            qty: item.qty,
            price: item.price,
            subtotal: item.qty * item.price,
            item_name: item.name,
            unit_name: item.unitName,
            note: item.note || '',
            price_tier_name: item.activeTierName || 'Manual',
            
            hpp_method: item.hppMethod,
            tax_percentage: item.saleTaxPercentage,
            tax_amount: (item.price * item.qty) * (item.saleTaxPercentage / 100),

            stok_product_uuid: item.productUuid,
            stok_variant_uuid: item.variantUuid || null,
            stok_unit: item.unitUuid,
            stok_qty_min: item.qty, 
            stok_shelve_uuid: item.shelveUuid, 
            shelve_uuid: item.shelveUuid 
        }));

        let catatan = '';
        if (isCreditSale.value) {
            catatan = cashAmount.value > 0 
                ? `Piutang (Kredit) - DP: ${formatCurrency(cashAmount.value)}`
                : `Piutang (Kredit) Penuh`;
        } else {
            catatan = remainingBalance.value > 0 
                ? `Tunai: ${formatCurrency(cashAmount.value)} | Kembali: ${formatCurrency(remainingBalance.value)}` 
                : 'Pembayaran Uang Pas';
        }

        const payload = {
            grand_total: grandTotal.value,
            total_items: cart.value.length,
            payment_method: transactionMeta.paymentMethod,
            customer_name: finalCustName,
            notes: catatan,
            status: isCreditSale.value ? 'PENDING' : 'COMPLETED',
            amount_cash: cashAmount.value,
            transaction_date: transactionMeta.transactionDate ? transactionMeta.transactionDate.toISOString() : new Date().toISOString(),
            cashier_uuid: transactionMeta.cashierUuid, 
            
            // [BARU] Kirim custom_journal_code jika bukan dari system
            ...(invoiceType.value !== 'system' && { custom_journal_code: transactionMeta.manualInvoiceCode }),

            ...(isCreditSale.value && {
                is_credit: 'true',
                due_date: transactionMeta.dueDate ? transactionMeta.dueDate.toISOString().split('T')[0] : null
            }),
            amount_credit: isCreditSale.value ? grandTotal.value : 0, 
            amount_installment: 0, 
            amount_bank_total: 0,
            shipping_cost: 0, 
            courier_uuid: null,
            member_uuid: transactionMeta.memberUuid || null, 
            target_store_uuid: null,
            items: itemsPayload
        };

        const response = await journalService.createSaleTransaction(payload);
        const transactionUuid = response?.data?.journal?.uuid || response?.journal?.uuid;
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Transaksi Berhasil Disimpan', life: 3000 });
        showPaymentModal.value = false; 
        cart.value = []; 
        resetState(); 
        await loadProducts(); 

        if (isPrint) {
            if (transactionUuid) {
                const printWindow = window.open(`/#/receipt/${transactionUuid}`, '_blank');
                if (!printWindow) {
                    const printWindow2 = window.open(`/receipt/${transactionUuid}`, '_blank');
                    if (!printWindow2) {
                        toast.add({ severity: 'warn', summary: 'Popup Diblokir', detail: 'Nota gagal terbuka. Izinkan Popup browser.', life: 6000 });
                    }
                }
            } else {
                toast.add({ severity: 'error', summary: 'Gagal Cetak', detail: 'Gagal mengambil ID struk.', life: 4000 });
            }
        }
    } catch (e) {
        console.error(e); 
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memproses transaksi', life: 3000 });
    } finally { 
        processing.value = false; 
    }
};

// --- DATA FETCHING & FILTERING ---
const fetchCategoriesAndBrands = async () => { 
    try { 
        const [catRes, brandRes] = await Promise.all([
            categoryService.getAllCategories(),
            brandService.getAllBrands(),
        ]);
        
        categories.value = catRes?.data?.data || catRes?.data || catRes || [];
        brands.value = brandRes?.data?.data || brandRes?.data || brandRes || [];
        
        let uData = null;
        if (userService.getAllUsers) uData = await userService.getAllUsers();
        else if (userService.fetchUsers) uData = await userService.fetchUsers();
        else if (userService.getUsers) uData = await userService.getUsers();
        users.value = uData?.data?.data || uData?.data || uData || [];

        if (authStore.user?.uuid && !transactionMeta.cashierUuid) {
            transactionMeta.cashierUuid = authStore.user.uuid;
        }
    } catch (e) {} 
};

const loadProducts = async () => {
    loading.value = true; products.value = []; 
    try {
        const response = await productService.getAllProducts(currentPage.value, limit, searchQuery.value.toLowerCase().trim());
        const rawProducts = response?.data || response || [];
        products.value = rawProducts.map(p => ({ 
            ...p, 
            prices: p.prices || [], 
            variants: p.variants || [], 
            unit: p.unit || null, 
            categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean),
            categoryUuid: p.categoryUuid || p.category?.uuid, 
            categoryName: p.category?.name || '',
            brandUuid: p.brandUuid || p.brand?.uuid, 
            brandName: p.brand?.name || '',
            hppMethod: p.hppMethod || 'FIFO',
            saleTaxPercentage: Number(p.saleTaxPercentage || 0)
        }));
        totalPages.value = response?.meta?.totalPage || 1; 
        totalProducts.value = response?.meta?.total || 0;
        
        handleLocalFiltering(true);
    } catch (error) { 
        console.error(error); 
    } finally { 
        loading.value = false; 
    }
};

const handleLocalFiltering = (isApiLoad = false) => {
    let result = products.value;
    const query = searchQuery.value.toLowerCase().trim();
    
    if (query) {
        if (!isApiLoad) { 
            result = result.filter(p => p.name.toLowerCase().includes(query) || (p.barcode && p.barcode.toLowerCase().includes(query)));
        }
    }

    if (selectedCategoryUuids.value.length > 0) {
        result = result.filter(p => {
            const uuids = p.categoryUuids || [];
            if (p.categoryUuid && !uuids.includes(p.categoryUuid)) uuids.push(p.categoryUuid);
            return uuids.some(c => selectedCategoryUuids.value.includes(c));
        });
    }

    if (selectedBrandUuids.value.length > 0) {
        result = result.filter(p => selectedBrandUuids.value.includes(p.brandUuid));
    }

    filteredProducts.value = result;
};

// --- INIT ---
onMounted(async () => {
    await fetchCategoriesAndBrands(); 
    await loadProducts(); 
    
    try { 
        const mData = await memberService.getMembers(); 
        members.value = mData?.data?.data || mData?.data || mData || []; 
    } catch (e) {}
    
    try { const sData = await shelveService.getAllShelves(); shelves.value = sData?.data || sData || []; } catch (e) {}
    
    window.addEventListener('keydown', (e) => { 
        if (e.key === 'F2') { e.preventDefault(); toggleScanMode(); } 
    });
    resetState();
});

const refreshData = async () => { currentPage.value = 1; await loadProducts(); }
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 font-sans">
        
        <div class="flex-1 flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200 overflow-hidden">
             
             <div class="px-4 py-3 border-b border-surface-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-surface-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600"><i class="pi pi-shop text-xl"></i></div>
                    <div><h1 class="text-lg font-bold leading-tight">{{ authStore.activeStore?.name || 'Point of Sale' }}</h1></div>
                </div>
                
                <div class="flex items-center gap-2">
                    <div class="flex items-center bg-surface-50 border border-surface-200 rounded-lg px-2 h-10 shadow-sm">
                        <i class="pi pi-calendar text-surface-400 mr-2 text-sm"></i>
                        <Calendar 
                            v-model="transactionMeta.transactionDate" 
                            dateFormat="dd M yy" 
                            showTime 
                            hourFormat="24"
                            class="!border-0 !w-44 !bg-transparent"
                            inputClass="!border-0 !bg-transparent !p-0 !text-sm !font-semibold !text-surface-700 focus:!ring-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            
            <div class="p-3 border-b border-surface-100 flex flex-col md:flex-row gap-2 bg-surface-0">
                <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                    <MultiSelect v-model="selectedCategoryUuids" :options="categories" optionLabel="name" optionValue="uuid" placeholder="Filter Kategori" display="chip" :maxSelectedLabels="1" class="w-full sm:w-40 !h-10 !text-sm" @change="handleLocalFiltering(false)" />
                    <MultiSelect v-model="selectedBrandUuids" :options="brands" optionLabel="name" optionValue="uuid" placeholder="Filter Merek" display="chip" :maxSelectedLabels="1" class="w-full sm:w-40 !h-10 !text-sm" @change="handleLocalFiltering(false)" />
                </div>
                
                <div class="relative flex-1 flex gap-2">
                    <div class="relative flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm"></i>
                        <input 
                            id="search-input-sale" 
                            v-model="searchQuery" 
                            @input="!isScanMode ? handleLocalFiltering(false) : null" 
                            type="text" 
                            :placeholder="isScanMode ? 'Tunggu scan barcode alat...' : 'Cari Manual Nama/SKU...'" 
                            class="w-full pl-9 pr-3 py-2 text-sm border rounded-lg h-10 focus:ring-primary-500 focus:border-primary-500" 
                            @keydown.enter.prevent="onSearchKeydown" 
                            @keydown.tab.prevent="onSearchKeydown"
                            autocomplete="off" 
                        />
                    </div>
                    <Button 
                        icon="pi pi-barcode" 
                        v-tooltip.top="isScanMode ? 'Matikan Scanner (F2)' : 'Aktifkan Scanner (F2)'" 
                        class="!w-10 !h-10 !rounded-lg shrink-0 transition-all" 
                        :class="isScanMode ? '!bg-primary-600 !text-white !border-primary-600 shadow-inner' : '!bg-surface-100 !text-surface-600 !border-surface-200'"
                        @click="toggleScanMode" 
                    />
                </div>
                
                 <div class="flex gap-1 bg-surface-100 rounded-lg p-1 h-10 border border-surface-200 shrink-0">
                    <button @click="viewMode = 'list'" class="w-8 h-full rounded flex items-center justify-center transition" :class="viewMode === 'list' ? 'bg-surface-0 shadow text-primary-600' : 'text-surface-400'"><i class="pi pi-list text-sm"></i></button>
                    <button @click="viewMode = 'grid'" class="w-8 h-full rounded flex items-center justify-center transition" :class="viewMode === 'grid' ? 'bg-surface-0 shadow text-primary-600' : 'text-surface-400'"><i class="pi pi-th-large text-sm"></i></button>
                    <div v-if="viewMode === 'grid'" class="flex gap-1 ml-1 border-l pl-1 border-surface-300">
                        <button v-for="n in [2, 3, 4, 5]" :key="n" @click="gridColumns = n" class="w-6 h-full rounded text-[10px] font-bold transition hidden lg:flex items-center justify-center" :class="gridColumns === n ? 'bg-surface-0 shadow text-primary-600' : 'text-surface-400'">{{ n }}</button>
                    </div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 scrollbar-thin">
                
                <div v-if="isScanMode" class="h-full flex flex-col items-center justify-center bg-surface-0/80 rounded-xl border-2 border-dashed border-primary-200 m-2 min-h-[400px]">
                    <div class="p-6 bg-primary-50 rounded-full mb-4 shadow-inner">
                        <i class="pi pi-barcode text-7xl text-primary-500 animate-pulse"></i>
                    </div>
                    <h2 class="text-2xl font-black text-surface-800">Mode Scan Aktif</h2>
                    <p class="text-surface-500 text-center mt-2 max-w-sm">
                        Silakan scan barcode produk fisik Anda menggunakan alat pemindai (scanner). Produk akan otomatis ditambahkan.
                    </p>
                    <Button label="Matikan Scanner" icon="pi pi-times" outlined severity="secondary" size="small" class="mt-6 !rounded-full" @click="toggleScanMode" />
                </div>

                <template v-else>
                    <div v-if="loading" class="flex justify-center p-10"><ProgressSpinner style="width: 40px; height: 40px" /></div>
                    
                    <div v-else-if="filteredProducts.length > 0" :class="gridContainerClass">
                        <div v-for="prod in filteredProducts" :key="prod.uuid" @click="addToCart(prod)" class="group relative bg-surface-0 border border-surface-200 rounded-xl cursor-pointer hover:border-primary-400 hover:shadow-md transition-all active:scale-95 select-none" :class="viewMode === 'grid' ? 'p-3 flex flex-col justify-between h-36' : 'p-2 flex items-center justify-between gap-3 h-16'">
                            
                            <div v-if="viewMode === 'grid'" class="flex flex-col h-full justify-between">
                                <div>
                                    <div class="text-xs font-bold line-clamp-2 mb-1 pr-1 group-hover:text-primary-600 transition">{{ prod.name }}</div>
                                    <div class="text-[9px] text-surface-400 font-mono mb-1 truncate"><i class="pi pi-barcode mr-1"></i>{{ prod.barcode || 'N/A' }}</div>
                                    
                                    <div class="flex flex-wrap gap-1 mt-1">
                                        <span v-if="prod.categoryName" class="text-[8px] bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded border border-surface-200">{{ prod.categoryName }}</span>
                                        <span v-if="prod.brandName" class="text-[8px] bg-surface-100 text-surface-500 px-1.5 py-0.5 rounded border border-surface-200"><i class="pi pi-bookmark text-[7px] mr-0.5"></i>{{ prod.brandName }}</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex gap-1 mt-2 items-center flex-wrap">
                                        <span v-if="prod.isManageStock === false" class="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-purple-50 text-purple-600 border-purple-200">Non-Fisik</span>
                                        <span v-else class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(getTotalStock(prod))">Stok: {{ getTotalStock(prod) }}</span>
                                        
                                        <span v-if="prod.saleTaxPercentage > 0" class="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">PPN {{ prod.saleTaxPercentage }}%</span>

                                        <Tag v-if="prod.variants && prod.variants.length > 0" value="Multi Varian" severity="info" class="!text-[8px] !px-1.5 !py-0.5" />
                                        <i v-if="prod.prices && prod.prices.some(p => p.minQty > 1)" class="pi pi-tags text-orange-500 text-[10px] ml-1" v-tooltip.top="'Ada Harga Grosir'"></i>
                                    </div>
                                    <div class="flex justify-between items-end mt-2"><span class="text-sm font-black text-surface-800">{{ formatCurrency(getBasePrice(prod)) }}</span></div>
                                </div>
                            </div>
                            
                             <div v-else class="flex items-center gap-3 w-full">
                                <div class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 shrink-0"><i class="pi pi-box"></i></div>
                                <div class="flex-1 min-w-0 flex flex-col justify-center">
                                    <div class="text-sm font-bold truncate flex items-center gap-2 group-hover:text-primary-600 transition">
                                        {{ prod.name }}
                                        <Tag v-if="prod.variants && prod.variants.length > 0" value="Multi Varian" severity="info" class="!text-[8px] !px-1.5" />
                                    </div>
                                    <div class="flex gap-2 items-center mt-0.5">
                                        <span class="text-[10px] text-surface-400 font-mono shrink-0"><i class="pi pi-barcode text-[9px] mr-0.5"></i>{{ prod.barcode || 'N/A' }}</span>
                                        <span v-if="prod.isManageStock === false" class="text-[10px] font-medium text-purple-500">Non-Fisik</span>
                                        <span v-else class="text-[10px] font-medium text-surface-500">Stok: {{ getTotalStock(prod) }}</span>
                                        <span v-if="prod.saleTaxPercentage > 0" class="text-[8px] font-bold px-1 py-0.5 rounded border bg-red-50 text-red-600 border-red-200">PPN {{ prod.saleTaxPercentage }}%</span>
                                    </div>
                                </div>
                                <div class="text-sm font-black shrink-0">{{ formatCurrency(getBasePrice(prod)) }}</div>
                            </div>

                        </div>
                    </div>
                    <div v-else class="flex flex-col items-center justify-center text-surface-400 gap-2 p-10 opacity-70">
                        <i class="pi pi-inbox text-4xl"></i>
                        <span>Produk tidak ditemukan</span>
                    </div>

                    <div v-if="totalPages > 1" class="flex justify-between mt-4 border-t border-surface-200 pt-3"><Button label="Prev" text size="small" :disabled="currentPage===1" @click="changePage(currentPage-1)" /><Button label="Next" text size="small" :disabled="currentPage===totalPages" @click="changePage(currentPage+1)" /></div>
                </template>
            </div>
        </div>

        <div class="w-full lg:w-[400px] xl:w-[450px] flex flex-col h-[calc(100vh-2rem)] bg-surface-0 rounded-2xl shadow-xl border border-surface-200 overflow-hidden flex-shrink-0">
            
            <div class="p-3 border-b border-surface-100 flex flex-col gap-3 bg-surface-50/50 backdrop-blur-md z-10">
                <div class="flex items-center gap-2 bg-white rounded border border-surface-200 px-2 py-1 shadow-sm">
                    <i class="pi pi-user text-primary-500 text-xs"></i>
                    <span class="text-[10px] font-bold text-surface-500 uppercase tracking-wider w-12">Kasir:</span>
                    <Dropdown 
                        v-model="transactionMeta.cashierUuid" 
                        :options="users" 
                        :optionLabel="(opt) => opt.name || opt.name" 
                        optionValue="uuid" 
                        filter
                        placeholder="Pilih Kasir..." 
                        class="w-full !h-7 !border-0 bg-transparent"
                        :pt="{ input: { class: '!py-0 !px-1 !text-xs !font-bold text-surface-700 flex items-center' }, trigger: { class: '!w-6' } }"
                    />
                </div>

                <div class="flex justify-between items-center px-1">
                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <i class="pi pi-shopping-cart text-lg text-surface-700"></i>
                            <span v-if="totalItems > 0" class="absolute -top-1.5 -right-2 bg-primary-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{{ totalItems }}</span>
                        </div>
                        <span class="font-bold text-base text-surface-800">Keranjang</span>
                    </div>
                    <Button v-if="cart.length > 0" label="Kosongkan" icon="pi pi-trash" text severity="danger" size="small" class="!text-xs !py-1 !px-2" @click="cart = []" />
                </div>
            </div>

            <div id="cart-items-container" class="flex-1 overflow-y-auto p-2 space-y-2 bg-surface-50 scroll-smooth">
                
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-400 gap-3 opacity-60 min-h-[300px]" @click="focusScanner">
                    <div class="w-32 h-32 flex items-center justify-center mb-2">
                        <i class="pi pi-cart-plus text-6xl text-surface-300"></i>
                    </div>
                    <p class="text-sm font-bold text-surface-600">Keranjang Kosong</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" class="bg-surface-0 rounded-lg p-2.5 shadow-sm border border-surface-200 transition-all duration-200 relative">
                    
                    <button class="absolute -top-2 -right-2 shadow border border-surface-200 bg-red-50 text-red-500 hover:text-white hover:bg-red-500 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>

                    <div class="flex justify-between items-center gap-2 cursor-pointer select-none group pr-4" @click="item.expanded = !item.expanded">
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold leading-tight truncate flex items-center gap-1 group-hover:text-primary-600 transition-colors">
                                <i class="pi text-[8px] text-surface-400 transition-transform" :class="item.expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                                {{ item.name }}
                            </div>
                            
                            <div class="flex items-center gap-1 mt-1 pl-3 flex-wrap">
                                <span class="bg-surface-100 text-surface-600 text-[8px] font-bold px-1 rounded border border-surface-200">{{ item.unitName }}</span>
                                <span class="text-[9px] font-mono text-surface-500">@ {{ formatCurrency(item.price) }}</span>
                                <span v-if="item.isGrosirActive" class="text-[8px] font-bold text-orange-600 bg-orange-100 border border-orange-200 px-1 rounded uppercase tracking-wider">Grosir</span>
                                <span v-if="item.saleTaxPercentage > 0" class="text-[8px] font-bold text-red-600 bg-red-100 border border-red-200 px-1 rounded uppercase tracking-wider">PPN {{ item.saleTaxPercentage }}%</span>
                                <span class="text-[8px] font-bold text-blue-600 bg-blue-100 border border-blue-200 px-1 rounded uppercase tracking-wider" v-tooltip.top="'Metode HPP yang digunakan'">HPP: {{ item.hppMethod }}</span>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 shrink-0" @click.stop>
                            <div class="flex items-center bg-white rounded border border-surface-200 h-6 overflow-hidden shadow-sm">
                                <button class="w-6 h-full flex items-center justify-center text-surface-500 hover:text-red-500 hover:bg-red-50 transition border-r border-surface-100" @click="item.qty > 1 ? changeItemQty(item, -1) : removeFromCart(index)">
                                    <i class="pi text-[8px] font-bold" :class="item.qty > 1 ? 'pi-minus' : 'pi-trash'"></i>
                                </button>
                                <input v-model.number="item.qty" type="number" class="w-8 text-center text-[10px] font-bold border-0 p-0 h-full focus:ring-0 bg-transparent" min="1" @change="recalculateItemPrice(item)" />
                                <button class="w-6 h-full flex items-center justify-center text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition border-l border-surface-100" @click="changeItemQty(item, 1)">
                                    <i class="pi pi-plus text-[8px] font-bold"></i>
                                </button>
                            </div>
                            <div class="text-sm font-black text-primary-600 w-16 text-right">{{ formatCurrency(item.price * item.qty) }}</div>
                            <Button icon="pi pi-trash" text severity="danger" class="!w-6 !h-6 !p-0" @click="removeFromCart(index)" v-tooltip.top="'Hapus Item'" />
                        </div>
                    </div>

                    <div v-show="item.expanded" class="mt-2 pt-2 border-t border-dashed border-surface-200 flex flex-col gap-2 pl-3">
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-bold text-surface-500 w-8">Rak:</span>
                            <Dropdown v-model="item.shelveUuid" :options="shelves" optionLabel="name" optionValue="uuid" class="flex-1 !h-6 !text-[9px]" :pt="{ root: { class: '!bg-surface-50 !border border-surface-200' }, input: { class: '!py-0 !px-1.5 !text-[9px] flex items-center' }, trigger: { class: '!w-5' } }" placeholder="Pilih Rak" />
                        </div>

                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-bold text-surface-500 w-8">Tier:</span>
                            <Dropdown v-model="item.basePriceObj" :options="item.selectableTiers" optionLabel="name" class="flex-1 !h-6 !text-[9px]" :class="{'!bg-orange-50 !text-orange-800 font-bold': item.isGrosirActive}" :pt="{ root: { class: '!bg-surface-50 !border border-surface-200' }, input: { class: '!py-0 !px-1.5 !text-[9px] flex items-center' }, trigger: { class: '!w-5' } }" @change="(e) => changeCartItemPriceTier(item, e.value)" />
                        </div>
                        
                        <div v-if="item.isCustomPrice" class="flex items-center gap-2">
                            <span class="text-[9px] font-bold text-surface-500 w-8">Hrg:</span>
                            <div class="relative flex items-center h-6 flex-1">
                                <span class="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-surface-400">Rp</span>
                                <InputNumber v-model="item.price" mode="decimal" locale="id-ID" class="w-full !h-6" inputClass="!pl-5 !pr-1 !py-0 !text-[10px] !h-6 !bg-white !border focus:!ring-primary-500 font-mono font-bold text-right rounded" :min="0" />
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div class="p-3 bg-surface-0 border-t border-surface-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20">
                <div class="space-y-1.5 mb-3">
                    <div class="flex justify-between items-center text-xs text-surface-500"><span>Subtotal (Tanpa PPN)</span><span class="font-mono">{{ formatCurrency(cartSubtotal) }}</span></div>
                    
                    <div v-if="taxAmount > 0" class="flex justify-between items-center text-xs text-surface-500">
                        <span>Pajak (PPN)</span>
                        <span class="font-mono text-red-500">+ {{ formatCurrency(taxAmount) }}</span>
                    </div>

                    <div class="border-t border-dashed border-surface-200 my-1.5"></div>
                    <div class="flex justify-between items-end"><span class="text-sm font-bold text-surface-800 uppercase tracking-wide">Total Bayar</span><span class="text-xl font-black text-primary-600">{{ formatCurrency(grandTotal) }}</span></div>
                </div>
                <Button label="Bayar / Checkout" icon="pi pi-arrow-right" iconPos="right" class="w-full !h-10 !text-sm !font-bold !rounded-xl shadow-md transition-all active:scale-95" severity="primary" @click="openPaymentModal" :disabled="cart.length === 0" />
            </div>
        </div>
    </div>
    
    <Dialog v-model:visible="showVariantModal" header="Pilih Varian Produk" modal class="w-full max-w-md" :pt="{ header: { class: '!pb-2 !border-b !border-surface-200' }, content: { class: '!pt-4' } }">
        <div v-if="selectedProductForVariant" class="flex flex-col gap-4">
            <div class="text-center">
                <div class="font-bold text-lg text-surface-800">{{ selectedProductForVariant.name }}</div>
                <div class="text-xs text-surface-500 mt-1">Silakan pilih varian yang akan dimasukkan ke pesanan.</div>
            </div>
            <div class="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar px-1">
                <button v-for="v in selectedProductForVariant.variants" :key="v.uuid"
                        @click="pushToCart(selectedProductForVariant, v)"
                        class="group flex justify-between items-center p-3 border border-surface-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 hover:shadow-sm transition-all text-left bg-surface-0">
                    <div>
                        <div class="font-bold text-sm text-surface-800 group-hover:text-primary-700 transition">{{ v.name }}</div>
                        <div class="text-[10px] text-surface-500 mt-1 flex items-center gap-2">
                            <span><i class="pi pi-barcode text-[9px]"></i> {{ v.barcode || '-' }}</span>
                            <span :class="getStockColor(Number(v.stock))" class="px-1.5 py-0.5 rounded border font-semibold">Stok: {{ v.stock || 0 }}</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end">
                        <div class="font-bold text-primary-600 text-sm bg-surface-100 group-hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                            {{ formatCurrency(v.prices?.[0]?.price || 0) }}
                        </div>
                        <div v-if="v.prices && v.prices.some(p => p.minQty > 1)" class="text-[8px] text-orange-500 mt-1 uppercase font-bold tracking-wider">Ada Harga Grosir</div>
                    </div>
                </button>
            </div>
        </div>
    </Dialog>

    <ProductCreateModal v-model:visible="showCreateProductModal" @saved="loadProducts" />

    <Dialog v-model:visible="showPaymentModal" class="w-full max-w-md m-4 !p-0" :pt="{ root: { class: '!border-0 !shadow-2xl' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-xl' } }" modal dismissableMask>
        <div class="bg-surface-0 overflow-hidden flex flex-col max-h-[95vh] border border-surface-100">
            
            <div class="flex justify-between items-center px-6 py-4 border-b border-surface-200 bg-surface-50">
                <div class="flex items-center gap-2">
                    <i class="pi pi-wallet text-primary-600 text-xl"></i>
                    <h3 class="font-bold text-xl text-surface-800">Selesaikan Pembayaran</h3>
                </div>
                <button @click="showPaymentModal = false" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition"><i class="pi pi-times"></i></button>
            </div>

            <div class="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
                
                <div class="flex flex-col items-center justify-center p-5 rounded-2xl border-2 bg-primary-50 border-primary-100 shadow-sm relative overflow-hidden">
                    <div class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                        <i class="pi pi-money-bill text-8xl"></i>
                    </div>
                    <span class="text-xs uppercase font-bold tracking-widest text-primary-600">Total Tagihan</span>
                    <div class="text-4xl font-black mt-1 text-primary-700">{{ formatCurrency(grandTotal) }}</div>
                </div>

                <div class="space-y-4">
                    <div class="p-3 bg-surface-100 border border-surface-200 rounded-xl mb-4" v-if="invoiceType !== 'system'">
                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Nomor Faktur / Invoice</label>
                        
                        <InputText v-if="isManualInvoice" v-model="transactionMeta.manualInvoiceCode" placeholder="Ketik No Faktur Manual..." class="w-full !text-sm font-mono font-bold" />
                        
                        <div v-else class="flex justify-between items-center bg-white p-2 rounded border border-surface-200 font-mono font-bold text-primary-700 text-sm">
                            <span>{{ transactionMeta.manualInvoiceCode }}</span>
                            <Button icon="pi pi-refresh" text rounded size="small" class="!w-6 !h-6 !p-0" @click="transactionMeta.manualInvoiceCode = generateInvoiceNumber()" v-tooltip.top="'Generate Ulang'" />
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Member</label>
                            <Dropdown v-model="transactionMeta.memberUuid" :options="members" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Member..." class="w-full !text-sm" showClear />
                        </div>
                        <div class="flex-1" v-if="!transactionMeta.memberUuid">
                            <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Pelanggan Umum</label>
                            <InputText v-model="transactionMeta.customerName" placeholder="Contoh: Bapak Budi" class="w-full !text-sm" />
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Metode Pembayaran</label>
                        <SelectButton 
                            v-model="transactionMeta.paymentMethod" 
                            :options="[{label:'Tunai (Lunas)', value:'CASH'}, {label:'Piutang (Kredit)', value:'CREDIT'}]" 
                            optionLabel="label" 
                            optionValue="value"
                            class="w-full"
                            :pt="{ button: { class: '!text-xs !py-2.5 flex-1' } }" 
                        />
                    </div>

                    <div v-if="isCreditSale" class="space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100 animate-fade-in-down">
                        <div v-if="!transactionMeta.memberUuid && !transactionMeta.customerName.trim()" class="text-xs text-red-500 font-bold bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                            <i class="pi pi-exclamation-triangle"></i> Nama Pelanggan wajib diisi untuk transaksi kredit.
                        </div>

                        <div>
                            <label class="text-xs font-bold text-orange-700 uppercase mb-1 block">Jatuh Tempo Pembayaran <span class="text-red-500">*</span></label>
                            <Calendar v-model="transactionMeta.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full" inputClass="!text-sm" placeholder="Pilih Tanggal..." />
                        </div>
                        
                        <div>
                            <label class="text-xs font-bold text-surface-600 uppercase block mb-1">Uang Muka / DP (Opsional)</label>
                            <InputNumber 
                                v-model="cashAmount" 
                                mode="currency" 
                                currency="IDR" 
                                locale="id-ID" 
                                class="w-full" 
                                :max="grandTotal"
                                inputClass="!text-lg !font-black !py-2 !text-orange-600 focus:!ring-orange-500 focus:border-orange-500" 
                            />
                        </div>
                    </div>

                    <div v-else class="space-y-3 pt-2 animate-fade-in-down">
                        <label class="text-xs font-bold text-surface-600 uppercase block">Nominal Uang Tunai yang Diterima</label>
                        <InputNumber 
                            v-model="cashAmount" 
                            mode="currency" 
                            currency="IDR" 
                            locale="id-ID" 
                            class="w-full" 
                            inputClass="!text-2xl !py-3 !font-black !text-center text-emerald-600 focus:!ring-emerald-500 focus:border-emerald-500" 
                        />

                        <div class="grid grid-cols-4 gap-2">
                            <Button label="Uang Pas" outlined severity="success" size="small" class="!px-1 !text-xs !font-bold" @click="cashAmount = grandTotal" />
                            <Button label="20.000" outlined severity="secondary" size="small" class="!px-1 !text-xs font-mono" @click="cashAmount = 20000" />
                            <Button label="50.000" outlined severity="secondary" size="small" class="!px-1 !text-xs font-mono" @click="cashAmount = 50000" />
                            <Button label="100.000" outlined severity="secondary" size="small" class="!px-1 !text-xs font-mono" @click="cashAmount = 100000" />
                        </div>
                    </div>
                </div>

            </div>

            <div class="p-4 border-t border-surface-200 bg-surface-50 space-y-4 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                
                <div class="flex justify-between items-center px-2" v-if="!isCreditSale">
                    <span class="text-sm font-bold text-surface-600 uppercase tracking-wide">
                        {{ remainingBalance < 0 ? 'Kurang Bayar' : 'Kembalian' }}
                    </span>
                    <span class="text-2xl font-black font-mono" :class="remainingBalance < 0 ? 'text-red-500' : 'text-emerald-500'">
                        {{ formatCurrency(Math.abs(remainingBalance)) }}
                    </span>
                </div>
                
                <div class="flex justify-between items-center px-2" v-else>
                    <span class="text-sm font-bold text-orange-600 uppercase tracking-wide">
                        Sisa Piutang Bersih
                    </span>
                    <span class="text-2xl font-black font-mono text-orange-600">
                        {{ formatCurrency(grandTotal - cashAmount) }}
                    </span>
                </div>

                <div class="flex flex-col sm:flex-row gap-2">
                    <Button label="Batal" class="flex-1 font-bold" severity="secondary" outlined @click="showPaymentModal = false" :disabled="processing" />
                    <Button 
                        :label="isCreditSale ? 'Catat Saja' : 'Bayar Saja'" 
                        class="flex-1 !h-12 !text-sm !font-bold !rounded-xl shadow-md transition-colors" 
                        :severity="isCreditSale ? 'warning' : 'success'" outlined
                        :loading="processing" 
                        :disabled="!canCheckout" 
                        @click="processCheckout(false)" 
                    />
                    <Button 
                        :label="isCreditSale ? 'Catat & Cetak Nota' : 'Bayar & Cetak Nota'" 
                        icon="pi pi-print" 
                        class="flex-[1.5] !h-12 !text-sm !font-bold !rounded-xl shadow-md transition-colors" 
                        :severity="isCreditSale ? 'warning' : 'success'" 
                        :loading="processing" 
                        :disabled="!canCheckout" 
                        @click="processCheckout(true)" 
                    />
                </div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
/* Membuat scrollbar lebih tipis agar rapi di panel keranjang */
.scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 10px; }
.scrollbar-thin:hover::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.8); }

.animate-fade-in-down { animation: fadeInDown 0.2s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

/* Menghilangkan panah spinner pada input number (browser webkit) */
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
input[type=number] { -moz-appearance: textfield; }
</style>