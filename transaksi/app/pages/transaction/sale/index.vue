<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProductCreateModal from '~/components/ProductCreateModal.vue';
import { useAuthStore } from '~/stores/auth.store'; // Import Store

const productService = useProductService();
const journalService = useJournalService();
const authStore = useAuthStore(); // Init Store
const toast = useToast();

// --- STATE ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const processing = ref(false);
const showCreateModal = ref(false);

const payment = reactive({
    amount: null,
});

// --- COMPUTED: SETTINGS (Dari AuthStore) ---
const taxEnabled = computed(() => authStore.getSetting('sale_tax_enabled', false));
const taxRate = computed(() => Number(authStore.getSetting('sale_tax_percentage', 0)));
const taxMethod = computed(() => authStore.getSetting('sale_tax_method', 'exclusive')); // 'exclusive' atau 'inclusive'

// --- COMPUTED: TRANSACTION LOGIC ---

// 1. Total Item (Qty)
const totalItems = computed(() => cart.value.reduce((a, b) => a + b.qty, 0));

// 2. Subtotal Murni (Harga Barang x Qty)
const cartSubtotal = computed(() => {
    return cart.value.reduce((total, item) => {
        return total + (item.price * item.qty);
    }, 0);
});

// 3. Hitung Nilai Pajak
const taxAmount = computed(() => {
    if (!taxEnabled.value || taxRate.value <= 0) return 0;

    if (taxMethod.value === 'exclusive') {
        // Exclusive: Pajak ditambahkan di atas harga (Subtotal * %)
        return cartSubtotal.value * (taxRate.value / 100);
    } else {
        // Inclusive: Pajak sudah termasuk di harga (Back-calculate)
        // Rumus: Total - (Total / (1 + rate))
        return cartSubtotal.value - (cartSubtotal.value / (1 + (taxRate.value / 100)));
    }
});

// 4. Grand Total (Yang harus dibayar user)
const grandTotal = computed(() => {
    if (!taxEnabled.value) return cartSubtotal.value;

    if (taxMethod.value === 'exclusive') {
        // Exclusive: Subtotal + Pajak
        return cartSubtotal.value + taxAmount.value;
    } else {
        // Inclusive: Harga barang sudah final, jadi Grand Total = Subtotal
        return cartSubtotal.value;
    }
});

// 5. Kembalian
const changeAmount = computed(() => {
    if (!payment.amount) return 0;
    return payment.amount - grandTotal.value;
});

// 6. Validasi Checkout
const canCheckout = computed(() => {
    return cart.value.length > 0 && payment.amount >= grandTotal.value;
});

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

    // 1. Cari Barcode Exact Match
    const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));

    if (exactProduct) {
        const matchedUnit = exactProduct.units.find(u => u.barcode === query);
        addToCart(exactProduct, matchedUnit);
        
        searchQuery.value = ''; 
        filteredProducts.value = products.value; 
        toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name}`, life: 1500 });
    } else {
        // 2. Filter Nama
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
    
    // Scroll ke bawah cart otomatis
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
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) {
        addToCart(fullProduct);
    }
};

const processCheckout = async () => {
    if (!canCheckout.value) return;

    processing.value = true;
    try {
        const payload = {
            amount: grandTotal.value,
            details: {
                payment_method: 'CASH',
                payment_received: payment.amount,
                change: changeAmount.value,
                total_items_count: cart.value.length,
                
                // Data Pajak Lengkap untuk Backend
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
        
        toast.add({ severity: 'success', summary: 'Transaksi Sukses', detail: 'Kembalian: ' + formatCurrency(changeAmount.value), life: 5000 });
        
        cart.value = [];
        payment.amount = null;
        await loadProducts(); 

    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat memproses', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const getStockColor = (qty) => {
    if (qty <= 0) return 'bg-red-100 text-red-600 border-red-200';
    if (qty < 10) return 'bg-amber-100 text-amber-600 border-amber-200';
    return 'bg-blue-50 text-blue-600 border-blue-200';
};

onMounted(async () => {
    // Pastikan data toko & settings dimuat agar setting pajak terbaca
    if (!authStore.activeStore) {
        await authStore.fetchUserStores();
    }

    loadProducts();
    
    // Shortcut F2 untuk Search
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2') document.getElementById('search-input')?.focus();
    });
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-[calc(100vh-5rem)] gap-4 p-4 overflow-hidden bg-surface-50 dark:bg-surface-950 font-sans">
        <Toast />

        <div class="flex-1 flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            <div class="p-3 border-b border-surface-100 dark:border-surface-800 flex gap-2 bg-surface-50/50">
                <div class="relative flex-1">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm"></i>
                    <input 
                        id="search-input"
                        v-model="searchQuery" 
                        type="text"
                        placeholder="Cari Produk / Scan Barcode... (F2)" 
                        class="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all shadow-sm"
                        @keydown="onSearchKeydown" 
                        @input="handleSearch"
                        autocomplete="off"
                    />
                </div>
                <Button icon="pi pi-plus" class="!w-10 !h-10 !rounded-lg" severity="primary" outlined v-tooltip.bottom="'Produk Baru'" @click="showCreateModal = true" />
            </div>

            <div class="flex-1 overflow-y-auto p-3 bg-surface-50 dark:bg-surface-950 scrollbar-thin">
                <div v-if="loading" class="flex justify-center py-20">
                    <ProgressSpinner style="width: 40px; height: 40px" />
                </div>

                <div v-else-if="filteredProducts.length > 0" class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                    <div v-for="prod in filteredProducts" :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="group relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 cursor-pointer hover:border-primary-400 hover:shadow-md transition-all active:scale-95 select-none flex flex-col justify-between h-28"
                    >
                        <div>
                            <div class="text-xs font-bold text-surface-700 dark:text-surface-200 line-clamp-2 mb-1 leading-snug group-hover:text-primary-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <div class="flex gap-1 mt-1">
                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border" :class="getStockColor(prod.stock?.reduce((a,b)=>a+b.qty,0)||0)">
                                    Stok: {{ prod.stock?.reduce((a,b)=>a+b.qty,0) || 0 }}
                                </span>
                                <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 border border-surface-200">
                                    {{ (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName }}
                                </span>
                            </div>
                        </div>
                        
                        <div class="flex justify-between items-end mt-2">
                            <span class="text-[10px] text-surface-400">Umum</span>
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

                <div v-else class="flex flex-col items-center justify-center h-full text-surface-400 gap-2 opacity-60">
                    <i class="pi pi-box text-4xl"></i>
                    <span class="text-xs">Produk tidak ditemukan</span>
                </div>
            </div>
        </div>

        <div class="w-[380px] flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden shrink-0">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 bg-surface-50/50 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                        <span class="font-bold text-xs">{{ totalItems }}</span>
                    </div>
                    <span class="font-bold text-sm text-surface-700">Keranjang</span>
                </div>
                <Button icon="pi pi-trash" text severity="danger" size="small" class="!w-8 !h-8" v-tooltip.left="'Kosongkan'" @click="cart = []" :disabled="cart.length === 0" />
            </div>

            <div id="cart-items-container" class="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin bg-surface-50/30">
                <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center text-surface-300 gap-3">
                    <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center">
                        <i class="pi pi-shopping-cart text-2xl opacity-40"></i>
                    </div>
                    <p class="text-xs">Belum ada item</p>
                </div>

                <div v-for="(item, index) in cart" :key="index" class="group bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-2.5 hover:border-primary-300 transition-all shadow-sm relative">
                    <button class="absolute -top-2 -right-2 bg-white shadow border border-surface-200 text-surface-400 hover:text-red-500 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" @click="removeFromCart(index)">
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
                                <button class="w-7 h-full flex items-center justify-center hover:bg-white rounded-l-lg transition text-surface-600 hover:text-red-500" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)">
                                    <i class="pi pi-minus text-[9px] font-bold"></i>
                                </button>
                                <input v-model="item.qty" type="number" class="w-8 h-full bg-transparent text-center text-xs font-bold border-none outline-none appearance-none m-0 p-0" min="1" />
                                <button class="w-7 h-full flex items-center justify-center hover:bg-white rounded-r-lg transition text-primary-600" @click="item.qty++">
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

            <div class="p-3 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 space-y-2">
                
                <div v-if="taxEnabled" class="space-y-1 border-b border-dashed border-surface-300 dark:border-surface-600 pb-2 mb-2">
                    <div class="flex justify-between items-center text-xs text-surface-500">
                        <span>Subtotal</span>
                        <span>{{ formatCurrency(cartSubtotal) }}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs text-surface-500">
                        <span>
                            Pajak ({{ taxRate }}%) 
                            <span v-if="taxMethod === 'inclusive'" class="text-[9px] bg-surface-200 px-1 rounded ml-1">Include</span>
                        </span>
                        <span>{{ formatCurrency(taxAmount) }}</span>
                    </div>
                </div>

                <div class="flex justify-between items-end">
                    <span class="text-xs text-surface-500 uppercase font-bold tracking-wider mb-1">Total Tagihan</span>
                    <span class="text-xl font-black text-primary-600">{{ formatCurrency(grandTotal) }}</span>
                </div>
            </div>
        </div>

        <div class="w-[320px] flex flex-col bg-surface-900 text-white rounded-xl shadow-lg overflow-hidden shrink-0 relative">
             <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
             
             <div class="p-4 flex-1 flex flex-col gap-5 relative z-10">
                <div class="text-center pt-2">
                    <h3 class="text-surface-400 text-xs uppercase tracking-widest font-bold mb-1">Total Harus Dibayar</h3>
                    <div class="text-3xl font-black tracking-tight text-white">{{ formatCurrency(grandTotal) }}</div>
                </div>

                <div class="bg-surface-800/50 p-3 rounded-xl border border-surface-700/50">
                    <label class="text-[10px] text-surface-400 uppercase font-bold mb-2 block">Uang Diterima (Cash)</label>
                    <InputNumber v-model="payment.amount" mode="currency" currency="IDR" locale="id-ID" 
                        class="w-full" placeholder="0" :min="0" autofocus
                        inputClass="!bg-surface-800 !border-surface-600 !text-white !text-lg !font-bold !text-center !rounded-lg focus:!border-primary-500 focus:!ring-0" />
                    
                    <div class="grid grid-cols-2 gap-2 mt-2">
                         <button class="py-1.5 bg-surface-700 hover:bg-surface-600 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = grandTotal">Uang Pas</button>
                         <button class="py-1.5 bg-surface-700 hover:bg-surface-600 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = 50000">50.000</button>
                         <button class="py-1.5 bg-surface-700 hover:bg-surface-600 rounded text-[10px] font-bold transition-colors border border-surface-600" @click="payment.amount = 100000">100.000</button>
                         <button class="py-1.5 bg-red-900/40 text-red-300 hover:bg-red-900/60 rounded text-[10px] font-bold transition-colors border border-red-900/50" @click="payment.amount = null">Clear</button>
                    </div>
                </div>

                <div class="flex-1 flex flex-col justify-center items-center border-t border-surface-800 border-dashed pt-2">
                    <span class="text-xs text-surface-400 mb-1">Kembalian</span>
                    <span class="text-2xl font-mono font-bold" :class="changeAmount < 0 ? 'text-red-400' : 'text-emerald-400'">
                        {{ formatCurrency(Math.max(0, changeAmount)) }}
                    </span>
                    <div v-if="changeAmount < 0" class="text-[10px] text-red-400 mt-1 bg-red-900/30 px-2 py-0.5 rounded">Kurang {{ formatCurrency(Math.abs(changeAmount)) }}</div>
                </div>
             </div>

             <div class="p-4 bg-surface-950 relative z-10">
                <Button label="PROSES BAYAR" icon="pi pi-print" 
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