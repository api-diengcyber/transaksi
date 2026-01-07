<script setup>
import { ref, computed, onMounted, reactive, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';

// --- SERVICES ---
const productService = useProductService();
const journalService = useJournalService();
const authStore = useAuthStore();
const toast = useToast();

// --- STATE UTAMA ---
const returnType = ref('sale'); // 'sale' | 'buy'
const loading = ref(true);
const processing = ref(false);
const showReturnModal = ref(false); // State untuk Modal Retur

const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');

// --- VIEW STATE ---
const viewMode = ref('grid'); // 'grid' | 'list'
const gridColumns = ref(4);   // 3 | 4 | 5

// --- PAGINATION ---
const currentPage = ref(1);
const limit = 16; 
const totalPages = ref(1);
const totalProducts = ref(0);

// --- STATE DOKUMEN RETUR ---
const returnDoc = reactive({
    referenceNo: '',
    notes: '',
    customerName: '', // Wajib jika Sale Return
    supplier: '',     // Wajib jika Buy Return
});

// --- COMPUTED ---
const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => total + (item.refundPrice * item.qty), 0);
});

const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

const canCheckout = computed(() => {
    return cart.value.length > 0 && grandTotal.value > 0;
});

const canProcessReturn = computed(() => {
    if (processing.value) return false;
    
    // Validasi Wajib
    if (returnType.value === 'sale' && !returnDoc.customerName) return false;
    if (returnType.value === 'buy' && !returnDoc.supplier) return false;

    return true;
});

// Helper Tanggal Header
const currentDate = computed(() => {
    return new Date().toLocaleDateString('id-ID', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
});

// Helper Grid Class Dinamis
const gridContainerClass = computed(() => {
    if (viewMode.value === 'list') {
        return 'flex flex-col gap-2';
    }
    if (gridColumns.value === 3) return 'grid grid-cols-2 md:grid-cols-3 gap-3';
    if (gridColumns.value === 5) return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3';
});

// --- ACTIONS ---

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        currentPage.value = 1;
        loadProducts(); 
    }
};

const loadProducts = async () => {
    loading.value = true;
    products.value = []; 

    try {
        const currentQuery = searchQuery.value.toLowerCase().trim();
        const response = await productService.getAllProducts(currentPage.value, limit, currentQuery);
        const data = response?.data || response || [];

        totalPages.value = response?.meta?.totalPage || response?.meta?.total_page || 1;
        totalProducts.value = response?.meta?.total || 0;

        products.value = data.map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
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
        const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));
        if (exactProduct) {
            const matchedUnit = exactProduct.units.find(u => u.barcode === query);
            addToCart(exactProduct, matchedUnit);
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name} ditambahkan`, life: 1500 });
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

// --- CART LOGIC ---

const openReturnModal = () => {
    if (!canCheckout.value) {
        toast.add({ severity: 'warn', summary: 'Kosong', detail: 'Pilih produk yang akan diretur terlebih dahulu', life: 2000 });
        return;
    }
    showReturnModal.value = true;
};

const addToCart = (product, specificUnit = null) => {
    let selectedUnit = specificUnit;
    if (!selectedUnit) {
        selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    }

    if (!selectedUnit) {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk tanpa satuan tidak bisa diretur.', life: 3000 });
        return;
    }

    let initialRefundPrice = 0;
    if (returnType.value === 'sale') {
        const unitPrices = product.prices.filter(p => p.unitUuid === selectedUnit.uuid);
        const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
        initialRefundPrice = defaultPriceObj ? defaultPriceObj.price : 0;
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
            refundPrice: initialRefundPrice, 
            qty: 1,
            availableUnits: product.units,
            allPrices: product.prices 
        });
    }
    
    nextTick(() => {
        const cartEl = document.getElementById('cart-items-container-return');
        if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
    });
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

// --- PROSES TRANSAKSI ---

const processReturn = async () => {
    if (!canProcessReturn.value) return;
    processing.value = true;

    try {
        const payload = {
            details: {
                grand_total: grandTotal.value * -1, 
                reference_no: returnDoc.referenceNo || '-',
                notes: returnDoc.notes,
                total_items_count: cart.value.length,
                ...(returnType.value === 'sale' && { customer_name: returnDoc.customerName || '-' }),
                ...(returnType.value === 'buy' && { supplier: returnDoc.supplier || '-' }),
            }
        };

        cart.value.forEach((item, index) => {
            payload.details[`product_uuid#${index}`] = item.productUuid;
            payload.details[`unit_uuid#${index}`] = item.unitUuid;
            payload.details[`qty#${index}`] = item.qty;
            payload.details[`price#${index}`] = item.refundPrice * -1; 
            payload.details[`subtotal#${index}`] = item.qty * item.refundPrice * -1; 
        });

        if (returnType.value === 'sale') {
            await journalService.createSaleReturnTransaction(payload);
        } else {
            await journalService.createBuyReturnTransaction(payload);
        }

        toast.add({ severity: 'success', summary: 'Sukses', detail: `Retur sebesar ${formatCurrency(grandTotal.value)} berhasil diproses.`, life: 5000 });
        
        // Reset
        cart.value = [];
        returnDoc.referenceNo = '';
        returnDoc.notes = '';
        returnDoc.customerName = '';
        returnDoc.supplier = '';
        showReturnModal.value = false;
        currentPage.value = 1;
        await loadProducts(); 

    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Transaksi gagal diproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
const getDefaultUnitName = (prod) => (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName;

// --- WATCHERS ---
watch(returnType, () => {
    // cart.value = []; // Opsional: Reset cart jika tipe retur berubah
    returnDoc.customerName = '';
    returnDoc.supplier = '';
});

watch(searchQuery, () => { handleLocalFiltering(false); });

onMounted(() => {
    loadProducts();
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') document.getElementById('search-input-return')?.focus();
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
                    <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 ">
                        <i class="pi pi-undo text-xl"></i>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold  leading-tight">
                            Retur Barang
                        </h1>
                        <p class="text-xs text-surface-500 ">
                            {{ authStore.activeStore?.name || 'Toko' }} &bull; {{ currentDate }}
                        </p>
                    </div>
                </div>
            </div>

            <div class="p-3 border-b border-surface-100  flex flex-col md:flex-row gap-2 bg-surface-0">
                <div class="w-full flex gap-2">
                    <div class="relative flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400  text-sm"></i>
                        <input 
                            id="search-input-return"
                            v-model="searchQuery" 
                            type="text"
                            placeholder="Cari Produk / Scan Barcode yang diretur... (Enter, F2)" 
                            class="w-full pl-9 pr-3 py-2 text-sm  border border-surface-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all shadow-sm h-10"
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
                            :class="viewMode === 'list' ? 'bg-surface-0  shadow text-red-600' : 'text-surface-400 hover:text-surface-600 '"
                        >
                            <i class="pi pi-list text-sm"></i>
                        </button>
                        <button 
                            v-tooltip.bottom="'Tampilan Grid'"
                            @click="viewMode = 'grid'"
                            class="w-8 h-full rounded flex items-center justify-center transition"
                            :class="viewMode === 'grid' ? 'bg-surface-0  shadow text-red-600' : 'text-surface-400 hover:text-surface-600 '"
                        >
                            <i class="pi pi-th-large text-sm"></i>
                        </button>
                        
                        <div v-if="viewMode === 'grid'" class="flex gap-1 ml-1 border-l border-surface-300 pl-1">
                            <button v-for="col in [3, 4, 5]" :key="col" @click="gridColumns = col" 
                                 class="w-6 h-full rounded text-[10px] font-bold transition hidden lg:flex items-center justify-center"
                                 :class="gridColumns === col ? 'bg-surface-0  shadow text-red-600' : 'text-surface-400 hover:text-surface-600 '"
                            >
                                {{ col }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 scrollbar-thin flex flex-col">
                 <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 40px; height: 40px" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="flex-1">
                    <div :class="gridContainerClass">
                        <div v-for="prod in filteredProducts" :key="prod.uuid"
                            @click="addToCart(prod)"
                            class="group relative bg-surface-0 border border-surface-200  rounded-xl cursor-pointer hover:border-red-400 hover:shadow-md transition-all active:scale-95 select-none"
                            :class="viewMode === 'grid' ? 'p-3 flex flex-col justify-between h-28' : 'p-2 flex items-center justify-between gap-3 h-16'"
                        >
                            <template v-if="viewMode === 'grid'">
                                <div>
                                    <div class="text-xs font-bold  line-clamp-2 mb-1 leading-snug group-hover:text-red-600 transition-colors">
                                        {{ prod.name }}
                                    </div>
                                </div>
                                <div class="flex justify-between items-end mt-1">
                                    <span class="text-[10px] font-medium text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded">
                                        {{ getDefaultUnitName(prod) }}
                                    </span>
                                    <i class="pi pi-plus-circle text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </template>

                            <template v-else>
                                <div class="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div class="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 shrink-0">
                                        <i class="pi pi-box"></i>
                                    </div>
                                    <div class="flex flex-col overflow-hidden">
                                        <div class="text-sm font-bold  truncate group-hover:text-red-600 transition-colors">{{ prod.name }}</div>
                                        <div class="flex gap-1.5 items-center mt-0.5">
                                            <span class="text-[9px] font-medium px-1.5 py-0.5 rounded border">{{ getDefaultUnitName(prod) }}</span>
                                        </div>
                                    </div>
                                </div>
                                <i class="pi pi-plus-circle text-red-500 text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </template>
                        </div>
                    </div>
                </div>

                <div v-else class="flex flex-col items-center justify-center h-full text-surface-400  gap-2 opacity-60 flex-1">
                    <i class="pi pi-search text-4xl"></i>
                    <span class="text-xs">Produk tidak ditemukan</span>
                </div>
                
                <div v-if="totalPages > 1 && !loading" class="mt-4 flex justify-between items-center border-t border-surface-200  pt-3 sticky bottom-0 bg-surface-50 z-10">
                    <Button icon="pi pi-chevron-left" label="Sebelumnya" size="small" text :disabled="currentPage === 1" @click="changePage(currentPage - 1)" class="!text-xs" />
                    <span class="text-xs font-medium text-surface-600 ">
                        Halaman <span class="font-bold text-red-600">{{ currentPage }}</span> dari {{ totalPages }}
                    </span>
                    <Button label="Selanjutnya" icon="pi pi-chevron-right" iconPos="right" size="small" text :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)" class="!text-xs" />
                </div>
            </div>
        </div>

        <div class="w-[420px] flex flex-col bg-surface-0 rounded-xl shadow-sm border border-surface-200  overflow-hidden shrink-0 h-[600px] lg:h-auto">
            <div class="p-3 border-b border-surface-100  bg-surface-50/50  flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ cart.length }}</span>
                    </div>
                    <span class="font-bold text-sm ">Daftar Item</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container-return" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30 ">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 gap-3">
                    <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center">
                        <i class="pi pi-inbox text-2xl opacity-40"></i>
                    </div>
                    <p class="text-xs">Belum ada item dipilih</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" 
                     class="group bg-surface-0 border border-surface-200  rounded-xl p-3 hover:border-red-400 transition-all shadow-sm relative">
                    
                    <button class="absolute -top-2 -right-2 bg-surface-0 shadow border border-surface-200  text-surface-400  hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>

                    <div class="mb-2 pr-4">
                        <div class="text-sm font-bold  line-clamp-1" :title="item.name">{{ item.name }}</div>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                        <div class="flex flex-col gap-1 flex-1">
                             <div class="inline-flex items-center h-6 bg-surface-50 rounded-lg px-2 border border-surface-200  w-fit">
                                <span class="text-[9px] text-surface-400 font-bold uppercase mr-1 tracking-wide">Unit</span>
                                <Dropdown 
                                    v-model="item.unitUuid" 
                                    :options="item.availableUnits" 
                                    optionLabel="unitName" 
                                    optionValue="uuid" 
                                    class="custom-tiny-dropdown !h-5 !border-none !bg-transparent !shadow-none min-w-[50px] !items-center"
                                    :pt="{ 
                                        input: { class: '!p-0 !text-[10px] font-bold ' }, 
                                        trigger: { class: '!w-4 text-surface-400' }
                                    }"
                                    @change="(e) => changeCartItemUnit(item, e.value)"
                                />
                            </div>

                            <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-surface-400">Rp</span>
                                <InputNumber 
                                    v-model="item.refundPrice" 
                                    mode="currency" currency="IDR" locale="id-ID" 
                                    class="!h-7 w-full" 
                                    inputClass="!text-xs !h-7 !py-0 !pl-6 !px-2 !font-mono !text-right !rounded-lg !bg-surface-50  !border-surface-200  focus:!border-red-500 focus:!ring-1 !text-red-600"
                                    :min="0" 
                                    placeholder="Nominal Refund"
                                />
                            </div>
                        </div>

                        <div class="flex flex-col items-end gap-1.5">
                            <div class="flex items-center bg-surface-100 rounded-lg border border-surface-200  h-7">
                                <button class="w-7 h-full flex items-center justify-center hover:bg-surface-200  rounded-l-lg transition text-surface-600  hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 " min="1" />
                                <button class="w-7 h-full flex items-center justify-center hover:bg-surface-200  rounded-r-lg transition text-primary-600" @click="item.qty++">
                                    <i class="pi pi-plus text-[9px] font-bold"></i>
                                </button>
                            </div>
                            <div class="text-xs font-black text-red-600  bg-surface-50 px-2 py-1 rounded border border-surface-200 ">
                                {{ formatCurrency(item.refundPrice * item.qty) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4  border-t border-surface-200  space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
                <div class="flex justify-between items-end">
                    <span class="text-sm text-surface-500  uppercase font-bold tracking-wider mb-1">Total Refund</span>
                    <span class="text-2xl font-black text-red-600 ">{{ formatCurrency(grandTotal) }}</span>
                </div>
                <Button label="Lanjut Proses" icon="pi pi-arrow-right" iconPos="right" class="w-full !h-12 !text-base !font-bold" severity="danger" @click="openReturnModal" :disabled="!canCheckout" />
            </div>
        </div>
    </div>

    <div v-if="showReturnModal" class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm transition-all">
        <div class="bg-surface-0 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            <div class="flex justify-between items-center p-4 border-b border-surface-200  bg-surface-50">
                <h3 class="font-bold text-lg  flex items-center gap-2">
                    <i class="pi pi-refresh text-red-600"></i>
                    Rincian Pengembalian
                </h3>
                <button @click="showReturnModal = false" class="text-surface-400 hover:text-surface-600  transition">
                    <i class="pi pi-times text-lg"></i>
                </button>
            </div>

            <div class="p-5 overflow-y-auto scrollbar-thin space-y-4">
                
                <div class="text-center p-4 bg-red-50 rounded-xl border border-red-100 ">
                    <span class="text-xs uppercase text-surface-500  tracking-widest font-bold">Total Nilai Retur</span>
                    <div class="text-3xl font-black text-red-700  mt-1">
                        {{ formatCurrency(grandTotal) }}
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Jenis Retur</label>
                        <SelectButton v-model="returnType" 
                            :options="[{label: 'Retur Penjualan', value: 'sale'}, {label: 'Retur Pembelian', value: 'buy'}]"
                            optionLabel="label" optionValue="value"
                            class="w-full"
                            :pt="{ 
                                button: ({ context }) => ({ 
                                    class: [
                                        '!text-xs !py-2.5 flex-1', 
                                        context.instance.value === 'sale' 
                                            ? '!bg-orange-50 !text-orange-600 !border-orange-200' 
                                            : '!bg-blue-50 !text-blue-600 !border-blue-200',
                                        ''
                                    ] 
                                }) 
                            }"
                        />
                        <small class="text-[10px] text-surface-400 block mt-1">
                            {{ returnType === 'sale' ? 'Barang masuk kembali dari pelanggan.' : 'Barang dikembalikan ke supplier.' }}
                        </small>
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">No. Referensi / Nota</label>
                        <InputText v-model="returnDoc.referenceNo" placeholder="Nomor Faktur / Nota Asli..." class="w-full !text-sm" />
                    </div>

                    <div v-if="returnType === 'sale'" class="space-y-1 animate-fade-in-down">
                        <label class="text-xs font-bold text-surface-500 uppercase">Nama Pelanggan <span class="text-red-500">*</span></label>
                        <InputText v-model="returnDoc.customerName" placeholder="Nama Pelanggan..." class="w-full !text-sm" />
                    </div>
                    
                    <div v-if="returnType === 'buy'" class="space-y-1 animate-fade-in-down">
                        <label class="text-xs font-bold text-surface-500 uppercase">Nama Supplier <span class="text-red-500">*</span></label>
                        <InputText v-model="returnDoc.supplier" placeholder="Nama Supplier..." class="w-full !text-sm" />
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-bold text-surface-500 uppercase">Alasan Retur</label>
                        <Textarea v-model="returnDoc.notes" rows="2" placeholder="Rusak / Cacat / Salah Beli..." class="w-full !text-sm resize-none" />
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-surface-200  bg-surface-50 flex gap-3">
                <Button label="Batal" class="flex-1" severity="secondary" outlined @click="showReturnModal = false" />
                <Button 
                    label="Konfirmasi Retur" 
                    :icon="processing ? 'pi pi-spinner pi-spin' : 'pi pi-check'" 
                    class="flex-[2]"
                    severity="danger"
                    :loading="processing" 
                    :disabled="!canProcessReturn"
                    @click="processReturn"
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