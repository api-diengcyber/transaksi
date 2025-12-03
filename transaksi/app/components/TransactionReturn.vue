<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const productService = useProductService();
const journalService = useJournalService();
const toast = useToast();

// --- STATE ---
const returnType = ref('sale'); // 'sale' | 'buy'
const loading = ref(true);
const processing = ref(false);

const products = ref([]);
const filteredProducts = ref([]);
const searchQuery = ref('');

// [PAGINASI] State Baru
const currentPage = ref(1);
const limit = 16; 
const totalPages = ref(1);
const totalProducts = ref(0);

const cart = ref([]);

// State Dokumen Retur
const returnDoc = reactive({
    referenceNo: '',
    notes: '',
    customerName: '', // Untuk retur penjualan
    supplier: '',     // Untuk retur pembelian
});

// --- COMPUTED ---
const grandTotal = computed(() => {
    // Total selalu NEGATIF (pengurangan omset/pengeluaran)
    return cart.value.reduce((total, item) => total + (item.refundPrice * item.qty), 0) * -1; 
});

const totalRefund = computed(() => grandTotal.value * -1);

const canProcessReturn = computed(() => {
    if (cart.value.length === 0 || totalRefund.value <= 0) return false;
    
    // Validasi spesifik (referensi wajib)
    if (returnType.value === 'sale' && !returnDoc.customerName) return false;
    if (returnType.value === 'buy' && !returnDoc.supplier) return false;

    return !processing.value;
});

// --- ACTIONS ---

// [BARU] Search Keydown untuk memicu API search dengan paginasi
const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        currentPage.value = 1; // Reset halaman ke 1 saat pencarian
        loadProducts(); 
    }
};

// [UPDATED] Load Products dengan Paginasi dan Perbaikan Error
const loadProducts = async () => {
    loading.value = true;
    products.value = []; 

    try {
        const currentQuery = searchQuery.value.toLowerCase().trim();

        // Panggil API dengan parameter page & limit (Asumsi getAllProducts mendukung ini)
        const response = await productService.getAllProducts(currentPage.value, limit, currentQuery);
        
        const data = response?.data || response || [];

        if (!Array.isArray(data)) {
            throw new Error("Format data produk dari server tidak valid (bukan Array).");
        }
        
        // Ambil data paginasi dari meta
        totalPages.value = response?.meta?.totalPage || response?.meta?.total_page || 1;
        totalProducts.value = response?.meta?.total || 0;

        products.value = data.map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            units: p.units || [],
        }));
        
        // Panggil handleSearch untuk memfilter data lokal (jika ada instant search)
        handleSearch(true); 
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

    if (query) {
        // Cek Barcode Persis (Scan)
        const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));
        if (exactProduct) {
            addToCart(exactProduct);
            searchQuery.value = ''; 
            toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name} ditambahkan`, life: 1500 });
            // Tampilkan kembali list produk yang dimuat API
            filteredProducts.value = products.value; 
            return; 
        }

        // Filter Teks Lokal (Hanya di data yang sudah dimuat)
        // Jika isApiLoad=false (berarti dipanggil dari @input)
        if (!isApiLoad) {
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.units.some(u => u.barcode?.includes(query))
            );
        }
    }

    filteredProducts.value = result;
};


const addToCart = (product) => {
    const selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    if (!selectedUnit) {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk tanpa satuan tidak bisa diretur.', life: 3000 });
        return;
    }

    const unitPrices = product.prices.filter(p => p.unitUuid === selectedUnit.uuid);
    const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    const initialRefundPrice = defaultPriceObj ? defaultPriceObj.price : 0; 

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
    setTimeout(() => {
        const cartEl = document.getElementById('cart-items-container-return');
        if(cartEl) cartEl.scrollTop = cartEl.scrollHeight;
    }, 50);
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const processReturn = async () => {
    if (!canProcessReturn.value) return;
    processing.value = true;

    try {
        const payload = {
            details: {
                // Kirim GrandTotal dalam nilai NEGATIF (wajib untuk Retur)
                grand_total: grandTotal.value, 
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
            // Harga yang dikirim juga harus NEGATIF agar nominal tercatat benar di Journal
            payload.details[`price#${index}`] = item.refundPrice * -1; 
            payload.details[`subtotal#${index}`] = item.qty * item.refundPrice * -1; 
        });

        if (returnType.value === 'sale') {
            await journalService.createSaleReturnTransaction(payload);
        } else {
            await journalService.createBuyReturnTransaction(payload);
        }

        toast.add({ severity: 'success', summary: 'Retur Sukses', detail: `Pengembalian sebesar ${formatCurrency(totalRefund.value)} berhasil dicatat.`, life: 5000 });
        
        // Reset state
        cart.value = [];
        Object.assign(returnDoc, { referenceNo: '', notes: '', customerName: '', supplier: '' });
        currentPage.value = 1; // Reset halaman
        await loadProducts(); 
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan saat memproses retur', life: 3000 });
    } finally {
        processing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const getDefaultUnitName = (prod) => {
    const defaultUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
    return defaultUnit?.unitName;
};

// --- Watchers ---
watch(returnType, () => {
    // Reset dokumen saat jenis retur berubah
    returnDoc.customerName = '';
    returnDoc.supplier = '';
});

onMounted(() => {
    loadProducts();
});

const refreshData = async () => {
    currentPage.value = 1;
    await loadProducts();
}
defineExpose({ refreshData });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-full gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-950 font-sans">
        
        <div class="w-[320px] flex flex-col dark:bg-surface-900 rounded-2xl shadow border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
             <div class="p-4 border-b border-surface-100 dark:border-surface-800 bg-surface-50/30 dark:bg-surface-950/50">
                 <h2 class="font-bold text-sm text-surface-700 dark:text-surface-200 flex items-center gap-2">
                     <div class="w-6 h-6 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <i class="pi pi-refresh text-red-600 dark:text-red-400 text-xs"></i>
                     </div>
                     Jenis Retur
                 </h2>
             </div>
             
             <div class="p-4 flex-1 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
                 <div class="field">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Pilih Tipe Retur</label>
                     <SelectButton v-model="returnType" 
                        :options="[{label: 'Retur Penjualan', value: 'sale'}, {label: 'Retur Pembelian', value: 'buy'}]"
                        optionLabel="label" optionValue="value"
                        class="w-full"
                        :pt="{ 
                            button: ({ context }) => ({ 
                                class: [
                                    '!text-xs !py-2', 
                                    context.instance.value === 'sale' 
                                        ? '!bg-red-500/10 !text-red-500 !border-red-500/50' 
                                        : '!bg-blue-500/10 !text-blue-500 !border-blue-500/50',
                                    'dark:!bg-surface-800 dark:!border-surface-700 dark:!text-surface-200'
                                ] 
                            }) 
                        }"
                    />
                 </div>
                 
                 <div class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">No. Referensi (Opsional)</label>
                     <InputText v-model="returnDoc.referenceNo" placeholder="No. Nota/Faktur" 
                        class="w-full !py-2.5 !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!transition-colors" />
                 </div>

                 <div v-if="returnType === 'sale'" class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Nama Pelanggan <span class="text-red-400">*</span></label>
                     <InputText v-model="returnDoc.customerName" placeholder="Nama Pelanggan" 
                        class="w-full !py-2.5 !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!transition-colors" />
                 </div>
                 
                 <div v-if="returnType === 'buy'" class="space-y-1">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Nama Supplier <span class="text-red-400">*</span></label>
                     <InputText v-model="returnDoc.supplier" placeholder="Nama Supplier" 
                        class="w-full !py-2.5 !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!transition-colors" />
                 </div>

                 <div class="space-y-1 flex-1 flex flex-col">
                     <label class="text-[10px] font-bold text-surface-400 uppercase tracking-wide ml-1">Catatan Retur</label>
                     <Textarea v-model="returnDoc.notes" placeholder="Alasan retur..." 
                        class="w-full !text-xs !rounded-xl !bg-surface-50 dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 focus:!transition-colors !p-3 resize-none flex-1 border-surface-200" />
                 </div>
             </div>

             <div class="p-4 bg-surface-150 dark:bg-surface-950/50 relative z-10 border-t border-surface-200 dark:border-surface-700">
                 <div class="flex justify-between items-end mb-2">
                    <span class="text-xs text-surface-500 uppercase font-bold tracking-wider mb-1">Total Pengembalian</span>
                    <span class="text-xl font-black text-red-600 dark:text-red-400 tracking-tight">{{ formatCurrency(totalRefund) }}</span>
                </div>
                <Button 
                    label="PROSES RETUR" 
                    icon="pi pi-check-circle" 
                    iconPos="right"
                    class="w-full font-bold !py-3 !text-sm !bg-red-500 hover:!bg-red-600 !border-none !text-white shadow-lg shadow-red-900/30 active:translate-y-0.5 transition-all !rounded-xl" 
                    :disabled="!canProcessReturn" 
                    :loading="processing" 
                    @click="processReturn" 
                />
             </div>
        </div>

        <div class="flex-1 flex flex-col dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            <div class="p-3 border-b border-surface-100 dark:border-surface-800 flex flex-col md:flex-row gap-2 bg-surface-50/50 dark:bg-surface-950/50">
                <div class="w-full">
                    <div class="relative flex-1">
                        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 text-sm"></i>
                        <input 
                            v-model="searchQuery" 
                            type="text"
                            placeholder="Cari Produk yang dikembalikan... (Enter untuk cari di database)" 
                            class="w-full pl-9 pr-3 py-2 text-sm dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all shadow-sm h-10"
                            @keydown="onSearchKeydown"
                            @input="handleSearch"
                            autocomplete="off"
                        />
                    </div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 dark:bg-surface-950 scrollbar-thin flex flex-col">
                 <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 40px; height: 40px" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 flex-1">
                    <div v-for="prod in filteredProducts" :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="group relative dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 cursor-pointer hover:border-red-400 hover:shadow-md transition-all active:scale-95 select-none flex flex-col justify-between h-28"
                    >
                        <div>
                            <div class="text-xs font-bold text-surface-700 dark:text-surface-200 line-clamp-2 mb-1 leading-snug group-hover:text-red-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-600">
                                Unit: {{ getDefaultUnitName(prod) }}
                            </span>
                        </div>
                        
                        <div class="flex justify-between items-end mt-2">
                            <span class="text-xs font-bold text-surface-500 dark:text-surface-300">
                                {{ formatCurrency(prod.prices?.find(p => p.isDefault)?.price || 0) }}
                            </span>
                        </div>
                    </div>
                </div>

                <div v-else class="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-600 gap-2 opacity-60 flex-1">
                    <i class="pi pi-box text-4xl"></i>
                    <span class="text-xs">Produk tidak ditemukan</span>
                </div>
                
                <div v-if="totalPages > 1 && !loading" class="mt-4 flex justify-between items-center border-t border-surface-200 dark:border-surface-700 pt-3 sticky bottom-0 bg-surface-50 dark:bg-surface-950">
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
                        Halaman <span class="font-bold text-red-600">{{ currentPage }}</span> dari {{ totalPages }}
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

        <div class="w-[380px] flex flex-col dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-950/50 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ cart.length }}</span>
                    </div>
                    <span class="font-bold text-sm text-surface-700 dark:text-surface-200">Item Retur</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container-return" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30 dark:bg-surface-950/30">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 dark:text-surface-700 gap-3">
                    <div class="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                        <i class="pi pi-inbox text-2xl opacity-40"></i>
                    </div>
                    <p class="text-xs">Pilih produk untuk dikembalikan</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" 
                     class="group dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-2.5 hover:border-red-400 dark:hover:border-red-600 transition-all shadow-sm relative">
                    
                    <button class="absolute -top-2 -right-2 dark:bg-surface-900 shadow border border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500 hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
                        <i class="pi pi-times text-[10px] font-bold"></i>
                    </button>

                    <div class="mb-2 pr-4">
                        <div class="text-sm font-bold text-surface-800 dark:text-surface-100 line-clamp-1" :title="item.name">{{ item.name }}</div>
                    </div>

                    <div class="flex items-center justify-between gap-2">
                        <div class="flex flex-col gap-2 flex-1">
                             <div class="inline-flex items-center h-7 bg-surface-50 dark:bg-surface-700 rounded-lg px-2 border border-surface-200 dark:border-surface-600 w-fit">
                                <span class="text-[9px] text-surface-400 font-bold uppercase mr-2 tracking-wide">Unit</span>
                                <Dropdown 
                                    v-model="item.unitUuid" 
                                    :options="item.availableUnits" 
                                    optionLabel="unitName" 
                                    optionValue="uuid" 
                                    class="custom-tiny-dropdown !h-5 !border-none !bg-transparent !shadow-none min-w-[60px] !items-center"
                                    :pt="{ 
                                        input: { class: '!p-0 !text-[11px] font-bold text-surface-700 dark:text-surface-200' }, 
                                        trigger: { class: '!w-4 text-surface-400' }
                                    }"
                                />
                            </div>

                            <InputNumber 
                                v-model="item.refundPrice" 
                                mode="currency" currency="IDR" locale="id-ID" 
                                class="!h-7 w-full" 
                                inputClass="!text-xs !h-7 !py-0 !px-2 !font-mono !text-right !rounded-lg !bg-surface-50 dark:!bg-surface-700 !border-surface-200 dark:!border-surface-600 focus:!border-red-500 focus:!ring-1 !text-red-600 dark:!text-red-400"
                                :min="0" 
                            />
                        </div>

                        <div class="flex flex-col items-end gap-1.5">
                            <div class="flex items-center bg-surface-100 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 h-7">
                                <button class="w-7 h-full flex items-center justify-center hover:dark:hover:bg-surface-800 rounded-l-lg transition text-surface-600 dark:text-surface-400 hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0 text-surface-800 dark:text-surface-100" min="1" />
                                <button class="w-7 h-full flex items-center justify-center hover:dark:hover:bg-surface-800 rounded-r-lg transition text-primary-600" @click="item.qty++">
                                    <i class="pi pi-plus text-[9px] font-bold"></i>
                                </button>
                            </div>
                            <div class="text-xs font-black text-red-600 dark:text-red-400 bg-surface-50 dark:bg-surface-700 px-2 py-1 rounded border border-surface-200 dark:border-surface-600">
                                -{{ formatCurrency(item.refundPrice * item.qty) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Custom Scrollbar Halus */
.scrollbar-thin::-webkit-scrollbar { width: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { 
    background: #e5e7eb; 
    border-radius: 4px; 
}
.dark .scrollbar-thin::-webkit-scrollbar-thumb { 
    background: #374151; 
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #4b5563; }

/* Override PrimeVue Dropdown agar rapih */
:deep(.custom-tiny-dropdown .p-dropdown-label) {
    padding: 0 !important;
    display: flex;
    align-items: center;
    white-space: nowrap;
}
</style>