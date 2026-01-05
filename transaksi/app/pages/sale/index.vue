<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick, defineAsyncComponent } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useBankService } from '~/composables/useBankService';
import { useProductService } from '~/composables/useProductService';
import { useJournalService } from '~/composables/useJournalService';
import { useCategoryService } from '~/composables/useCategoryService';
import { useUserService } from '~/composables/useUserService';
import { useStoreService } from '~/composables/useStoreService';
import { useCourierService } from '~/composables/useCourierService';
import { useTableService } from '~/composables/useTableService';

// --- COMPONENT IMPORTS ---
const ProductCreateModal = defineAsyncComponent(() => import('~/components/product/ProductCreateModal.vue'));

// --- SERVICES ---
const productService = useProductService();
const journalService = useJournalService();
const categoryService = useCategoryService();
const bankService = useBankService();
const userService = useUserService(); 
const storeService = useStoreService();
const courierService = useCourierService();
const tableService = useTableService();
const authStore = useAuthStore();
const toast = useToast();

const emit = defineEmits(['open-create-modal']);

// --- STATE UTAMA ---
const products = ref([]); 
const filteredProducts = ref([]); 
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);

// --- MODAL STATES ---
const showPaymentModal = ref(false);
const showCreateProductModal = ref(false);
const showTableModal = ref(false);

// --- VIEW STATE ---
const viewMode = ref('grid'); 
const gridColumns = ref(4); 
const categories = ref([]); 
const selectedCategoryUuids = ref([]);

// --- DATA MASTER ---
const banks = ref([]);
const members = ref([]);
const myStores = ref([]);
const couriers = ref([]); 
const availableRoutes = ref([]); 
const tables = ref([]); 

// --- STATE TRANSAKSI ---
const transactionType = ref('SALE'); // 'SALE' | 'MUTATION'
const isPreOrder = ref(false); 

const transactionMeta = reactive({
    memberUuid: null,
    customerName: '', 
    targetStoreUuid: null,
});

// --- STATE PENGIRIMAN ---
const shippingState = reactive({
    enable: false,
    courierUuid: null,
    routeUuid: null,
    cost: 0
});

// --- STATE PEMBAYARAN MULTI ---
const paymentLines = ref([]); 

// --- PAGINATION ---
const currentPage = ref(1);
const limit = 12;
const totalPages = ref(1);
const totalProducts = ref(0);

// --- COMPUTED ---
const taxEnabled = computed(() => authStore.getSetting('sale_tax_enabled', false));
const taxRate = computed(() => Number(authStore.getSetting('sale_tax_percentage', 0)));
const taxMethod = computed(() => authStore.getSetting('sale_tax_method', 'exclusive'));

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));
const cartSubtotal = computed(() => cart.value.reduce((total, item) => total + (item.price * item.qty), 0));

const taxAmount = computed(() => {
    if (!taxEnabled.value || taxRate.value <= 0) return 0;
    return taxMethod.value === 'exclusive' 
        ? cartSubtotal.value * (taxRate.value / 100)
        : cartSubtotal.value - (cartSubtotal.value / (1 + (taxRate.value / 100)));
});

const grandTotal = computed(() => {
    let total = taxMethod.value === 'exclusive' ? cartSubtotal.value + taxAmount.value : cartSubtotal.value;
    if (shippingState.enable && shippingState.cost > 0) total += Number(shippingState.cost);
    return total;
});

const currentDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

// --- LOGIKA PEMBAYARAN & CICILAN ---
const totalInputAmount = computed(() => paymentLines.value.reduce((sum, line) => sum + (line.amount || 0), 0));
const remainingBalance = computed(() => grandTotal.value - totalInputAmount.value);
const hasDebtOrInstallment = computed(() => paymentLines.value.some(l => l.type === 'KREDIT' || l.type === 'CICILAN'));

const getInstallmentSchedule = (line) => {
    if (line.type !== 'CICILAN' || line.amount <= 0 || line.tenor <= 0) return [];
    const principalPerMonth = line.amount / line.tenor;
    const totalPerMonth = principalPerMonth + (line.fee || 0);
    const schedule = [];
    let baseDate = line.dueDate ? new Date(line.dueDate) : new Date();
    for (let i = 1; i <= line.tenor; i++) {
        let nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + (i - 1));
        schedule.push({ no: i, date: nextDate, total: totalPerMonth });
    }
    return schedule;
};

// --- VALIDASI ---
const canCheckout = computed(() => {
    if (cart.value.length === 0) return false;
    if (processing.value) return false;

    if (transactionType.value === 'MUTATION' && !transactionMeta.targetStoreUuid) return false;
    const needsCustomer = (transactionType.value === 'SALE') && (hasDebtOrInstallment.value || isPreOrder.value);
    if (needsCustomer) {
        if (!transactionMeta.memberUuid && (!transactionMeta.customerName || transactionMeta.customerName.trim() === '')) return false;
    }

    if (shippingState.enable && (!shippingState.courierUuid || !shippingState.routeUuid)) return false;

    if (!hasDebtOrInstallment.value && remainingBalance.value > 100) return false; 
    if (hasDebtOrInstallment.value && Math.abs(remainingBalance.value) > 100) return false;

    for (const line of paymentLines.value) {
        if (line.amount <= 0) return false;
        if (line.type === 'TUNAI' && line.subType === 'BANK' && !line.bankUuid) return false;
        if ((line.type === 'KREDIT' || line.type === 'CICILAN') && !line.dueDate) return false;
    }

    return true;
});

// --- WATCHERS ---
watch(() => shippingState.courierUuid, async (newVal) => {
    shippingState.routeUuid = null; shippingState.cost = 0;
    if (newVal) {
        try { availableRoutes.value = await courierService.getRoutes(newVal) || []; } catch (e) { availableRoutes.value = []; }
    } else availableRoutes.value = [];
});
watch(() => shippingState.routeUuid, (newVal) => {
    const route = availableRoutes.value.find(r => r.uuid === newVal);
    shippingState.cost = route ? Number(route.price) : 0;
});
watch(transactionType, (val) => {
    if(val === 'MUTATION') {
        isPreOrder.value = false;
        transactionMeta.memberUuid = null;
        transactionMeta.customerName = '';
        paymentLines.value = [{ type: 'KREDIT', amount: grandTotal.value, subType: 'CASH', bankUuid: null, dueDate: new Date(), tenor: 1, fee: 0, showSchedule: false }];
    } else {
        transactionMeta.targetStoreUuid = null;
        resetPaymentLines();
    }
});
watch(() => shippingState.cost, () => {
    if (paymentLines.value.length === 1 && paymentLines.value[0].type === 'TUNAI') {
        paymentLines.value[0].amount = grandTotal.value;
    }
});

// --- ACTIONS ---
const resetPaymentLines = () => {
    paymentLines.value = [{ type: 'TUNAI', amount: grandTotal.value, subType: 'CASH', bankUuid: null, dueDate: new Date(), tenor: 1, fee: 0, showSchedule: false }];
};

const resetState = () => {
    resetPaymentLines();
    transactionType.value = 'SALE';
    isPreOrder.value = false;
    transactionMeta.memberUuid = null;
    transactionMeta.customerName = '';
    transactionMeta.targetStoreUuid = null;
    shippingState.enable = false;
    shippingState.courierUuid = null; shippingState.routeUuid = null; shippingState.cost = 0;
};

// Hanya view
const onTableClick = (table) => {
    const status = table.is_occupied ? 'TERISI' : 'KOSONG';
    const severity = table.is_occupied ? 'error' : 'success';
    toast.add({ severity: severity, summary: `Info Meja: ${table.name}`, detail: `Status: ${status}`, life: 2000 });
};

const addPaymentLine = () => {
    const sisa = remainingBalance.value > 0 ? remainingBalance.value : 0;
    paymentLines.value.push({ type: 'TUNAI', amount: sisa, subType: 'CASH', bankUuid: null, dueDate: new Date(), tenor: 1, fee: 0, showSchedule: false });
};
const removePaymentLine = (index) => {
    paymentLines.value.splice(index, 1);
    if (paymentLines.value.length === 0) addPaymentLine();
};
const setMaxAmount = (index) => {
    let currentTotalOther = 0;
    paymentLines.value.forEach((l, i) => { if (i !== index) currentTotalOther += (l.amount || 0); });
    const sisa = grandTotal.value - currentTotalOther;
    paymentLines.value[index].amount = sisa > 0 ? sisa : 0;
};

const openPaymentModal = () => {
    if (cart.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Keranjang Kosong', detail: 'Pilih produk dulu', life: 2000 });
        return;
    }
    if (paymentLines.value.length === 1 && paymentLines.value[0].type === 'TUNAI') {
        paymentLines.value[0].amount = grandTotal.value;
    }
    showPaymentModal.value = true;
};

const processCheckout = async () => {
    if (!canCheckout.value) return;
    processing.value = true;

    try {
        // --- 1. Kalkulasi Split Pembayaran ---
        let amountCash = 0;
        let amountCredit = 0;
        let amountInstallment = 0;
        
        // Object dinamis untuk menampung pembayaran per bank
        // Format: { amount_bank_UUID1: 10000, amount_bank_UUID2: 5000 }
        const bankAmounts = {}; 
        let totalBankAmount = 0;
        
        paymentLines.value.forEach(l => {
            const amt = Number(l.amount) || 0;
            if (l.type === 'TUNAI') {
                if (l.subType === 'CASH') {
                    amountCash += amt;
                } else if (l.subType === 'BANK') {
                    totalBankAmount += amt;
                    if (l.bankUuid) {
                        // Kumpulkan nominal per UUID Bank
                        const key = `amount_bank_${l.bankUuid}`;
                        bankAmounts[key] = (bankAmounts[key] || 0) + amt;
                    }
                }
            } else if (l.type === 'KREDIT') {
                amountCredit += amt;
            } else if (l.type === 'CICILAN') {
                amountInstallment += amt;
            }
        });

        // --- 2. Tentukan Metode Pembayaran Utama ---
        let mainMethod = 'CASH';
        if (transactionType.value === 'MUTATION') mainMethod = 'CREDIT'; 
        else if (hasDebtOrInstallment.value) mainMethod = 'CREDIT';
        else {
            if (amountCash > 0 && totalBankAmount > 0) mainMethod = 'MIXED';
            else if (totalBankAmount > 0) mainMethod = 'TRANSFER';
        }

        // --- 3. Info Customer ---
        let finalCustName = 'Umum';
        if (transactionType.value === 'MUTATION') {
            finalCustName = `Mutasi: ${myStores.value.find(s => s.uuid === transactionMeta.targetStoreUuid)?.name}`;
        } else {
            if (transactionMeta.memberUuid) finalCustName = members.value.find(m => m.uuid === transactionMeta.memberUuid)?.name || 'Member';
            else if (transactionMeta.customerName) finalCustName = transactionMeta.customerName;
        }

        // --- 4. Notes ---
        const notesArr = [];
        if(isPreOrder.value) notesArr.push('[PRE-ORDER]');
        if (shippingState.enable) notesArr.push(`Ekspedisi: ${formatCurrency(shippingState.cost)}`);
        
        paymentLines.value.forEach(l => {
            if (l.type === 'TUNAI') {
                const via = l.subType === 'BANK' 
                    ? `Transfer ${banks.value.find(b=>b.uuid===l.bankUuid)?.bank_name||''}` 
                    : 'Cash';
                notesArr.push(`Bayar: ${formatCurrency(l.amount)} (${via})`);
            } else if (l.type === 'KREDIT') notesArr.push(`Kredit: ${formatCurrency(l.amount)}`);
            else if (l.type === 'CICILAN') notesArr.push(`Cicilan: ${formatCurrency(l.amount)}`);
        });

        // --- 5. Clean Items Payload ---
        const itemsPayload = cart.value.map(item => ({
            product_uuid: item.productUuid,
            unit_uuid: item.unitUuid,
            qty: item.qty,
            price: item.price,
            subtotal: item.qty * item.price,
            item_name: item.name,
            unit_name: item.unitName,
            note: item.note || '',
            price_tier_name: item.selectedPriceObj?.name || 'Manual',
            
            // Param Stok (Optional, jika backend butuh)
            stok_product_uuid: item.productUuid,
            stok_unit: item.unitUuid,
            stok_qty_min: item.qty, 
        }));

        // --- 6. Final Payload Construction ---
        const payload = {
            // Header Utama
            grand_total: grandTotal.value,
            total_items: cart.value.length,
            payment_method: mainMethod,
            customer_name: finalCustName,
            notes: notesArr.join(' | '),
            
            status: isPreOrder.value ? 'PENDING' : 'COMPLETED',
            due_date: (hasDebtOrInstallment.value) ? paymentLines.value.find(l => l.type !== 'TUNAI')?.dueDate : null,
            
            // Nominal Dasar
            amount_cash: amountCash,
            amount_credit: amountCredit,
            amount_installment: amountInstallment,
            amount_bank_total: totalBankAmount, // Opsional: total semua transfer

            // [SPREAD] Nominal Per Bank (amount_bank_UUID: value)
            ...bankAmounts,
            
            // Shipping
            shipping_cost: shippingState.enable ? shippingState.cost : 0,
            courier_uuid: shippingState.enable ? shippingState.courierUuid : null,
            
            // References
            member_uuid: transactionMeta.memberUuid || null,
            target_store_uuid: transactionType.value === 'MUTATION' ? transactionMeta.targetStoreUuid : null,
            
            // Items
            items: itemsPayload
        };

        // Kirim ke Backend
        await journalService.createSaleTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Transaksi Berhasil', life: 3000 });
        showPaymentModal.value = false; cart.value = []; resetState(); await loadProducts(); 
    } catch (e) {
        console.error(e); 
        const msg = e.response?._data?.message || 'Terjadi Kesalahan';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally { processing.value = false; }
};

// --- STANDARD FUNCTIONS ---
const addToCart = (product) => {
    let unit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0]; if(!unit) return;
    const unitPrices = product.prices.filter(p => p.unitUuid === unit.uuid);
    const priceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    const item = cart.value.find(i => i.productUuid === product.uuid && i.unitUuid === unit.uuid);
    if(item) item.qty++;
    else cart.value.push({ productUuid: product.uuid, name: product.name, unitUuid: unit.uuid, unitName: unit.unitName, price: priceObj?.price||0, qty: 1, selectedPriceObj: priceObj, availableUnits: product.units, allPrices: product.prices });
    nextTick(() => { const el = document.getElementById('cart-items-container'); if(el) el.scrollTop = el.scrollHeight; });
};
const changeCartItemUnit = (item, newUnitUuid) => {
    const unit = item.availableUnits.find(u => u.uuid === newUnitUuid); if(!unit) return;
    item.unitUuid = unit.uuid; item.unitName = unit.unitName;
    const unitPrices = item.allPrices.filter(p => p.unitUuid === unit.uuid);
    const priceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    item.selectedPriceObj = priceObj; item.price = priceObj?.price||0;
};
const changeCartItemPriceTier = (item, newPriceObj) => { if(newPriceObj) { item.selectedPriceObj = newPriceObj; item.price = newPriceObj.price; } };
const removeFromCart = (index) => { cart.value.splice(index, 1); };
const onSearchKeydown = (event) => { if (event.key === 'Enter') { currentPage.value = 1; loadProducts(); } };
const fetchCategories = async () => { try { categories.value = await categoryService.getAllCategorys() || []; } catch (e) {} };
const loadProducts = async () => {
    loading.value = true; products.value = []; 
    try {
        const response = await productService.getAllProducts(currentPage.value, limit, searchQuery.value.toLowerCase().trim(), selectedCategoryUuids.value.join(','));
        products.value = (response?.data || []).map(p => ({ ...p, prices: p.prices || [], units: p.units || [], categoryUuids: (p.productCategory || []).map(pc => pc.category?.uuid).filter(Boolean) }));
        totalPages.value = response?.meta?.totalPage || 1; totalProducts.value = response?.meta?.total || 0;
    } catch (error) { console.error(error); } finally { loading.value = false; }
};
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
const getDefaultUnitStock = (prod) => (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.currentStock || 0; 
const getStockColor = (qty) => { if (qty <= 0) return 'bg-red-100 text-red-600'; if (qty < 10) return 'bg-amber-100 text-amber-600'; return 'bg-blue-50 text-blue-600'; };

onMounted(async () => {
    await fetchCategories(); await loadProducts(); 
    try { const data = await userService.getAllUsers({ role: 'member' }); members.value = data || []; } catch (e) {}
    try { const bData = await bankService.getAllBanks(); banks.value = bData || []; } catch (e) {}
    try { const sData = await storeService.getMyStore(); if (sData) myStores.value = sData.filter(s => s.uuid !== authStore.activeStore?.uuid); } catch (e) {}
    try { const cData = await courierService.getCouriers(); couriers.value = cData || []; } catch (e) {}
    try { const tData = await tableService.getAllTables(); tables.value = tData || []; } catch (e) {}
    window.addEventListener('keydown', (e) => { if (e.key === 'F2') { e.preventDefault(); document.getElementById('search-input-sale')?.focus(); } });
    resetState();
});
const refreshData = async () => { currentPage.value = 1; await loadProducts(); }
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-100 font-sans">
        
        <div class="flex-1 flex flex-col bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
             <div class="px-4 py-3 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-0 dark:bg-surface-100">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400"><i class="pi pi-shop text-xl"></i></div>
                    <div><h1 class="text-lg font-bold text-surface-800 dark:text-surface-100 leading-tight">{{ authStore.activeStore?.name || 'POS' }}</h1></div>
                </div>
                <div class="flex items-center gap-2">
                    <Button label="Lihat Denah Meja" icon="pi pi-table" size="small" outlined severity="secondary" @click="showTableModal = true" />
                    <div class="hidden md:block text-right text-sm font-bold text-surface-700 dark:text-surface-200 ml-3">{{ currentDate }}</div>
                </div>
            </div>
            
            <div class="p-3 border-b border-surface-100 dark:border-surface-800 flex flex-col md:flex-row gap-2 bg-surface-0 dark:bg-surface-100">
                <MultiSelect v-model="selectedCategoryUuids" :options="categories" optionLabel="name" optionValue="uuid" placeholder="Filter Kategori" display="chip" :maxSelectedLabels="1" class="w-full md:w-48 !h-10 !text-sm" />
                <div class="relative flex-1">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm"></i>
                    <input id="search-input-sale" v-model="searchQuery" type="text" placeholder="Cari Produk (F2)" class="w-full pl-9 pr-3 py-2 text-sm border rounded-lg h-10 dark:bg-surface-100 dark:border-surface-700" @keydown="onSearchKeydown" />
                </div>
                 <div class="flex gap-1 bg-surface-100 dark:bg-surface-100 rounded-lg p-1 h-10 border border-surface-200 dark:border-surface-700">
                    <button @click="viewMode = 'list'" class="w-8 h-full rounded flex items-center justify-center transition" :class="viewMode === 'list' ? 'bg-surface-0 dark:bg-surface-600 shadow text-primary-600' : 'text-surface-400'"><i class="pi pi-list text-sm"></i></button>
                    <button @click="viewMode = 'grid'" class="w-8 h-full rounded flex items-center justify-center transition" :class="viewMode === 'grid' ? 'bg-surface-0 dark:bg-surface-600 shadow text-primary-600' : 'text-surface-400'"><i class="pi pi-th-large text-sm"></i></button>
                    <div v-if="viewMode === 'grid'" class="flex gap-1 ml-1 border-l pl-1 border-surface-300">
                        <button v-for="n in [2, 3, 4, 5]" :key="n" @click="gridColumns = n" class="w-6 h-full rounded text-[10px] font-bold transition hidden lg:flex items-center justify-center" :class="gridColumns === n ? 'bg-surface-0 dark:bg-surface-600 shadow text-primary-600' : 'text-surface-400'">{{ n }}</button>
                    </div>
                </div>
                <Button icon="pi pi-plus" class="!w-10 !h-10 !rounded-lg" severity="primary" outlined v-tooltip.bottom="'Tambah Produk Baru'" @click="showCreateProductModal = true" />
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 dark:bg-surface-100 scrollbar-thin">
                <div v-if="loading" class="flex justify-center p-10"><ProgressSpinner style="width: 40px; height: 40px" /></div>
                <div v-else-if="products.length > 0" :class="gridContainerClass">
                    <div v-for="prod in products" :key="prod.uuid" @click="addToCart(prod)" class="group relative bg-surface-0 dark:bg-surface-100 border border-surface-200 dark:border-surface-700 rounded-xl cursor-pointer hover:border-primary-400 hover:shadow-md transition-all active:scale-95 select-none" :class="viewMode === 'grid' ? 'p-3 flex flex-col justify-between h-28' : 'p-2 flex items-center justify-between gap-3 h-16'">
                        <div v-if="viewMode === 'grid'">
                            <div class="text-xs font-bold text-surface-700 dark:text-surface-200 line-clamp-2 mb-1">{{ prod.name }}</div>
                            <div class="flex gap-1 mt-1"><span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(getDefaultUnitStock(prod))">Stok: {{ getDefaultUnitStock(prod) }}</span></div>
                            <div class="flex justify-between items-end mt-2"><span class="text-sm font-black text-surface-800 dark:text-white">{{ formatCurrency((prod.prices?.find(p => p.isDefault)?.price || prod.prices?.[0]?.price || 0)) }}</span></div>
                        </div>
                         <div v-else class="flex items-center gap-3 w-full">
                            <div class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 shrink-0"><i class="pi pi-box"></i></div>
                            <div class="flex-1 min-w-0"><div class="text-sm font-bold truncate">{{ prod.name }}</div><div class="text-[10px] text-surface-500">Stok: {{ getDefaultUnitStock(prod) }}</div></div>
                            <div class="text-sm font-black">{{ formatCurrency((prod.prices?.find(p => p.isDefault)?.price || prod.prices?.[0]?.price || 0)) }}</div>
                        </div>
                    </div>
                </div>
                 <div v-if="totalPages > 1" class="flex justify-between mt-4 border-t pt-2"><Button label="Prev" text size="small" :disabled="currentPage===1" @click="changePage(currentPage-1)" /><Button label="Next" text size="small" :disabled="currentPage===totalPages" @click="changePage(currentPage+1)" /></div>
            </div>
        </div>

        <div class="w-full lg:w-[400px] xl:w-[450px] flex flex-col h-[calc(100vh-2rem)] bg-surface-0 dark:bg-surface-100 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 overflow-hidden flex-shrink-0">
            
            <div class="p-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-surface-50/50 backdrop-blur-md z-10">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <i class="pi pi-shopping-cart text-xl text-surface-700 dark:text-surface-200"></i>
                        <span v-if="totalItems > 0" class="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{{ totalItems }}</span>
                    </div>
                    <span class="font-bold text-lg text-surface-800 dark:text-surface-100">Pesanan</span>
                </div>
                <Button v-if="cart.length > 0" label="Reset" icon="pi pi-trash" text severity="danger" size="small" class="!text-xs !px-2" @click="cart = []" />
            </div>

            <div id="cart-items-container" class="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-50 dark:bg-surface-100 scroll-smooth">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-400 gap-4 opacity-60 min-h-[300px]">
                    <div class="w-24 h-24 rounded-full bg-surface-100 flex items-center justify-center"><i class="pi pi-shopping-bag text-4xl"></i></div>
                    <p class="text-sm font-medium">Keranjang belum terisi</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" class="group relative bg-surface-0 dark:bg-surface-100 rounded-xl p-3 shadow-sm border border-transparent hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200 hover:shadow-md">
                    <button @click="removeFromCart(index)" class="absolute -top-2 -right-2 bg-surface-0 dark:bg-surface-700 text-surface-400 hover:text-red-500 w-6 h-6 rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 scale-0 group-hover:scale-100 border border-surface-100"><i class="pi pi-times text-[10px] font-bold"></i></button>

                    <div class="flex justify-between items-start gap-2 mb-2">
                        <div class="flex-1">
                            <div class="text-sm font-bold text-surface-800 dark:text-surface-100 leading-tight line-clamp-2 mb-1" :title="item.name">{{ item.name }}</div>
                            <div class="flex items-center gap-1">
                                <Dropdown v-model="item.unitUuid" :options="item.availableUnits" optionLabel="unitName" optionValue="uuid" class="!h-6 !text-[10px] w-24" :pt="{ root: { class: '!bg-surface-50 !border-0' }, input: { class: '!py-0 !px-2 !text-[10px]' }, trigger: { class: '!w-6' } }" @change="(e) => changeCartItemUnit(item, e.value)" />
                                <Dropdown v-model="item.selectedPriceObj" :options="item.allPrices.filter(p => p.unitUuid === item.unitUuid)" optionLabel="name" class="!h-6 !text-[10px] w-20" :pt="{ root: { class: '!bg-surface-50 !border-0' }, input: { class: '!py-0 !px-2 !text-[10px]' }, trigger: { class: '!w-6' } }" placeholder="Tier" @change="(e) => changeCartItemPriceTier(item, e.value)" />
                            </div>
                        </div>
                        <div class="text-right"><div class="text-sm font-black text-primary-600 dark:text-primary-400">{{ formatCurrency(item.price * item.qty) }}</div></div>
                    </div>

                    <div class="flex items-center justify-between gap-3 bg-surface-50 dark:bg-surface-100/50 p-1.5 rounded-lg">
                        <div class="flex-1 min-w-0">
                            <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-surface-400">Rp</span>
                                <InputNumber v-model="item.price" mode="decimal" locale="id-ID" class="w-full !h-7" inputClass="!pl-6 !pr-2 !py-0 !text-xs !h-7 !bg-transparent !border-0 focus:!ring-0 font-mono font-medium text-surface-700" :min="0" @input="item.selectedPriceObj = null" />
                            </div>
                        </div>
                        
                        <div class="flex items-center bg-surface-0 dark:bg-surface-100 rounded-md shadow-sm border border-surface-200 dark:border-surface-700 h-7 shrink-0 overflow-hidden">
                            <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:text-red-500 hover:bg-red-50 transition border-r border-surface-100" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                <i class="pi text-[10px] font-bold" :class="item.qty > 1 ? 'pi-minus' : 'pi-trash'"></i>
                            </button>
                            <InputNumber v-model="item.qty" class="!w-10" inputClass="!w-full !text-center !text-xs !border-0 !p-0 !h-full font-bold focus:!ring-0 bg-transparent" :min="1" />
                            <button class="w-7 h-full flex items-center justify-center text-surface-500 hover:text-primary-600 hover:bg-primary-50 transition border-l border-surface-100" @click="item.qty++">
                                <i class="pi pi-plus text-[10px] font-bold"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4 bg-surface-0 dark:bg-surface-100 border-t border-surface-200 dark:border-surface-800 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20">
                <div class="space-y-2 mb-4">
                    <div class="flex justify-between items-center text-sm text-surface-500"><span>Subtotal</span><span class="font-mono">{{ formatCurrency(cartSubtotal) }}</span></div>
                    <div v-if="taxEnabled" class="flex justify-between items-center text-sm text-surface-500"><span>Pajak ({{ taxRate }}%)</span><span class="font-mono text-red-500">+ {{ formatCurrency(taxAmount) }}</span></div>
                    <div class="border-t border-dashed border-surface-200 my-2"></div>
                    <div class="flex justify-between items-end"><span class="text-base font-bold text-surface-800 uppercase tracking-wide">Total Bayar</span><span class="text-2xl font-black text-primary-600 dark:text-primary-400">{{ formatCurrency(grandTotal) }}</span></div>
                </div>
                <Button label="Proses Pembayaran" icon="pi pi-arrow-right" iconPos="right" class="w-full !h-12 !text-base !font-bold !rounded-xl shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all transform active:scale-95" severity="primary" @click="openPaymentModal" :disabled="cart.length === 0" />
            </div>
        </div>
    </div>
    
    <Dialog v-model:visible="showTableModal" header="Denah Meja Restoran" modal class="w-full max-w-2xl">
        <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
            <div v-for="table in tables" :key="table.uuid" 
                 class="aspect-square rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105"
                 :class="table.is_occupied ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200 hover:border-green-400'"
                 @click="onTableClick(table)">
                <i class="pi pi-stop text-2xl mb-1" :class="table.is_occupied ? 'text-red-400' : 'text-green-500'"></i>
                <span class="font-bold text-sm">{{ table.name }}</span>
                <span class="text-[10px] uppercase font-bold" :class="table.is_occupied ? 'text-red-500' : 'text-green-600'">
                    {{ table.is_occupied ? 'Terisi' : 'Kosong' }}
                </span>
            </div>
        </div>
        <div class="text-xs text-surface-500 mt-4 text-center italic">* Klik meja untuk melihat detail status. Ini hanya tampilan denah, tidak memilih meja untuk transaksi.</div>
    </Dialog>

    <ProductCreateModal v-model:visible="showCreateProductModal" @saved="loadProducts" />

    <div v-if="showPaymentModal" class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm transition-all">
        <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] border border-surface-100 dark:border-surface-700" :class="{'ring-2 ring-purple-500': isPreOrder, 'ring-2 ring-blue-500': transactionType === 'MUTATION'}">
            
            <div class="flex justify-between items-center px-6 py-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-100">
                <div class="flex items-center gap-2">
                    <h3 class="font-bold text-xl text-surface-800 dark:text-surface-100">Pembayaran</h3>
                    <span v-if="isPreOrder" class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-bold border border-purple-200">PO (Pre-Order)</span>
                    <span v-if="transactionType === 'MUTATION'" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-200">MUTASI STOK</span>
                </div>
                <button @click="showPaymentModal = false" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition"><i class="pi pi-times"></i></button>
            </div>

            <div class="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
                
                <div class="flex flex-col items-center justify-center p-5 rounded-2xl border-2" :class="isPreOrder ? 'bg-purple-50 border-purple-100' : 'bg-primary-50 border-primary-100'">
                    <span class="text-xs uppercase font-bold tracking-widest text-surface-500">Total Tagihan</span>
                    <div class="text-4xl font-black mt-1" :class="isPreOrder ? 'text-purple-700' : 'text-primary-700'">{{ formatCurrency(grandTotal) }}</div>
                    <span v-if="shippingState.enable && shippingState.cost > 0" class="text-xs font-semibold text-surface-600 mt-1 flex items-center gap-1"><i class="pi pi-truck"></i> Termasuk Ongkir {{ formatCurrency(shippingState.cost) }}</span>
                </div>

                <div class="grid grid-cols-1 gap-4">
                     <div class="flex p-1 bg-surface-100 dark:bg-surface-100 rounded-lg">
                         <button class="flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2" :class="transactionType === 'SALE' ? 'bg-surface-0 dark:bg-surface-100 text-primary-600 shadow-sm' : 'text-surface-500'" @click="transactionType = 'SALE'"><i class="pi pi-user"></i> Penjualan</button>
                        <button class="flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2" :class="transactionType === 'MUTATION' ? 'bg-surface-0 dark:bg-surface-100 text-blue-600 shadow-sm' : 'text-surface-500'" @click="transactionType = 'MUTATION'"><i class="pi pi-arrow-right-arrow-left"></i> Mutasi Cabang</button>
                    </div>

                    <div v-if="transactionType === 'SALE'" class="space-y-3">
                        <div class="flex gap-3">
                            <div class="flex-1">
                                <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Pelanggan</label>
                                <Dropdown v-model="transactionMeta.memberUuid" :options="members" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Member..." class="w-full !text-sm" showClear />
                            </div>
                            <div class="flex-1" v-if="!transactionMeta.memberUuid">
                                <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Nama Umum</label>
                                <InputText v-model="transactionMeta.customerName" placeholder="Cth: Bapak Budi" class="w-full !text-sm" />
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between bg-surface-50 dark:bg-surface-100/50 px-3 py-2 rounded-lg border border-surface-200">
                            <div class="flex flex-col"><span class="text-xs font-bold text-surface-700">Pre-Order (PO)</span><span class="text-[9px] text-surface-500">Aktifkan jika barang belum ready</span></div>
                            <InputSwitch v-model="isPreOrder" class="scale-75" />
                        </div>
                    </div>

                    <div v-if="transactionType === 'MUTATION'">
                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Toko Tujuan</label>
                        <Dropdown v-model="transactionMeta.targetStoreUuid" :options="myStores" optionLabel="name" optionValue="uuid" placeholder="Pilih Cabang..." class="w-full !text-sm" />
                    </div>
                </div>

                <div class="bg-surface-0 dark:bg-surface-100 border border-surface-200 rounded-xl overflow-hidden">
                    <div class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-100/30 cursor-pointer" @click="shippingState.enable = !shippingState.enable">
                        <div class="flex items-center gap-2"><i class="pi pi-truck text-surface-500"></i><span class="text-sm font-bold text-surface-700">Pengiriman Ekspedisi</span></div>
                        <InputSwitch v-model="shippingState.enable" class="scale-75" @click.stop />
                    </div>
                    <div v-if="shippingState.enable" class="p-3 border-t border-surface-100 space-y-3 bg-surface-0 animate-fade-in-down">
                        <div class="grid grid-cols-2 gap-3">
                            <div><label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Kurir</label><Dropdown v-model="shippingState.courierUuid" :options="couriers" optionLabel="name" optionValue="uuid" placeholder="Pilih..." class="w-full !text-xs" /></div>
                            <div><label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Layanan</label><Dropdown v-model="shippingState.routeUuid" :options="availableRoutes" optionLabel="destination" optionValue="uuid" placeholder="Pilih..." class="w-full !text-xs" :disabled="!shippingState.courierUuid">
                                <template #option="slotProps"><div class="flex justify-between w-full"><span>{{ slotProps.option.destination }}</span><span class="font-bold">{{ formatCurrency(slotProps.option.price) }}</span></div></template>
                            </Dropdown></div>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-3">
                        <label class="text-sm font-bold text-surface-800">Metode Pembayaran</label>
                        <button @click="addPaymentLine" class="text-xs text-primary-600 font-bold hover:bg-primary-50 px-3 py-1.5 rounded-lg transition border border-primary-100 flex items-center gap-1"><i class="pi pi-plus"></i> Tambah</button>
                    </div>

                    <div class="space-y-3">
                        <div v-for="(line, idx) in paymentLines" :key="idx" class="relative p-3 rounded-xl border-l-4 shadow-sm bg-surface-0 border border-surface-200 transition-all hover:shadow-md" :class="{'border-l-emerald-500': line.type === 'TUNAI', 'border-l-orange-500': line.type === 'KREDIT', 'border-l-purple-500': line.type === 'CICILAN'}">
                            <div class="flex gap-3 items-start">
                                <div class="w-32 shrink-0">
                                    <Dropdown v-model="line.type" :options="['TUNAI', 'KREDIT', 'CICILAN']" class="w-full !text-xs font-bold" :pt="{ input: { class: '!py-2' } }">
                                        <template #value="slotProps"><div class="flex items-center gap-2"><i class="pi" :class="{'pi-wallet text-emerald-500': slotProps.value==='TUNAI', 'pi-book text-orange-500': slotProps.value==='KREDIT', 'pi-calendar text-purple-500': slotProps.value==='CICILAN'}"></i><span>{{ slotProps.value }}</span></div></template>
                                        <template #option="slotProps"><div class="flex items-center gap-2"><i class="pi" :class="{'pi-wallet text-emerald-500': slotProps.option==='TUNAI', 'pi-book text-orange-500': slotProps.option==='KREDIT', 'pi-calendar text-purple-500': slotProps.option==='CICILAN'}"></i><span>{{ slotProps.option }}</span></div></template>
                                    </Dropdown>
                                </div>
                                <div class="flex-1 relative">
                                    <InputNumber v-model="line.amount" mode="currency" currency="IDR" locale="id-ID" placeholder="0" class="w-full" inputClass="!text-sm !py-2 !font-bold" />
                                    <button v-if="remainingBalance > 0 && line.amount !== remainingBalance" @click="setMaxAmount(idx)" class="absolute right-1 top-1/2 -translate-y-1/2 bg-surface-100 hover:bg-surface-200 text-[9px] font-bold px-2 py-1 rounded text-surface-600 transition">MAX</button>
                                </div>
                                <button @click="removePaymentLine(idx)" class="w-9 h-[38px] flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><i class="pi pi-trash"></i></button>
                            </div>

                            <div class="mt-3 pt-2 border-t border-dashed border-surface-200 text-xs space-y-2">
                                <div v-if="line.type === 'TUNAI'" class="flex gap-2 items-center"><span class="text-surface-500 w-16">Metode:</span><Dropdown v-model="line.subType" :options="['CASH', 'BANK']" class="w-24 !text-[10px]" :pt="{ input: { class: '!py-1' } }" /><Dropdown v-if="line.subType === 'BANK'" v-model="line.bankUuid" :options="banks" optionLabel="bank_name" optionValue="uuid" placeholder="Pilih Bank" class="flex-1 !text-[10px]" :pt="{ input: { class: '!py-1' } }" /></div>
                                <div v-if="line.type === 'KREDIT'" class="flex gap-2 items-center"><span class="text-surface-500 w-16">Jatuh Tempo:</span><Calendar v-model="line.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="flex-1" inputClass="!text-[10px] !py-1" /></div>
                                <div v-if="line.type === 'CICILAN'" class="space-y-2">
                                    <div class="flex gap-3">
                                        <div class="flex-1"><label class="text-[9px] font-bold text-surface-500 block mb-1">Tenor</label><InputNumber v-model="line.tenor" :min="1" showButtons buttonLayout="horizontal" class="w-full" inputClass="!text-[10px] !text-center !w-8 !py-1" /></div>
                                        <div class="flex-1"><label class="text-[9px] font-bold text-surface-500 block mb-1">Bunga/Bln</label><InputNumber v-model="line.fee" mode="currency" currency="IDR" class="w-full" inputClass="!text-[10px] !py-1" /></div>
                                        <div class="flex-[1.5]"><label class="text-[9px] font-bold text-surface-500 block mb-1">Mulai</label><Calendar v-model="line.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full" inputClass="!text-[10px] !py-1" /></div>
                                    </div>
                                    <div class="bg-purple-50 rounded border border-purple-100 overflow-hidden">
                                        <button @click="line.showSchedule = !line.showSchedule" class="w-full flex justify-between items-center px-3 py-1.5 text-[10px] font-bold text-purple-700 hover:bg-purple-100 transition"><span><i class="pi pi-calendar mr-1"></i> Simulasi: {{ formatCurrency((line.amount/line.tenor) + line.fee) }}/bln</span><i class="pi" :class="line.showSchedule ? 'pi-chevron-up' : 'pi-chevron-down'"></i></button>
                                        <div v-if="line.showSchedule" class="p-2 border-t border-purple-100 max-h-32 overflow-y-auto custom-scrollbar"><table class="w-full text-[9px]"><thead class="text-purple-500 border-b border-purple-200"><tr><th class="text-left pb-1">Ke</th><th class="text-left pb-1">Tanggal</th><th class="text-right pb-1">Total</th></tr></thead><tbody><tr v-for="sch in getInstallmentSchedule(line)" :key="sch.no"><td class="py-1">{{ sch.no }}</td><td class="py-1">{{ new Date(sch.date).toLocaleDateString('id-ID') }}</td><td class="py-1 text-right font-bold">{{ formatCurrency(sch.total) }}</td></tr></tbody></table></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div class="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-100 space-y-3">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-medium text-surface-600">{{ remainingBalance > 0 ? (hasDebtOrInstallment ? 'Sisa (Akan jadi Hutang)' : 'Kurang Bayar') : 'Kembalian' }}</span>
                    <span class="text-xl font-black font-mono" :class="remainingBalance > 100 ? 'text-red-500' : 'text-emerald-500'">{{ formatCurrency(Math.abs(remainingBalance)) }}</span>
                </div>
                <div class="flex gap-3">
                    <Button label="Batal" class="flex-1" severity="secondary" outlined @click="showPaymentModal = false" />
                    <Button :label="hasDebtOrInstallment || transactionType === 'MUTATION' || isPreOrder ? 'Simpan Transaksi' : 'Bayar Lunas'" :icon="processing ? 'pi pi-spinner pi-spin' : 'pi pi-check'" class="flex-[2] font-bold" :severity="hasDebtOrInstallment || isPreOrder ? 'help' : 'success'" :loading="processing" :disabled="!canCheckout" @click="processCheckout" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 20px; }
.custom-tiny-dropdown :deep(.p-dropdown-label) { padding: 0 0.5rem !important; }
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>