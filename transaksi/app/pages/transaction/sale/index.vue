<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';

const productService = useProductService();
const journalService = useJournalService();
const toast = useToast();

// --- STATE ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);

// State Pembayaran (Simpel: Hanya Amount)
const payment = reactive({
    amount: null,
});

// --- COMPUTED ---

const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => {
        return total + (item.price * item.qty);
    }, 0);
});

const changeAmount = computed(() => {
    if (!payment.amount) return 0;
    return payment.amount - grandTotal.value;
});

const canCheckout = computed(() => {
    return cart.value.length > 0 && payment.amount >= grandTotal.value;
});

// --- ACTIONS ---

const loadProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        products.value = (data || []).map(p => ({
            ...p,
            prices: p.prices || p.price || [],
            stock: p.stock || []
        }));
        filteredProducts.value = products.value;
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat produk', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// [FIX] Wrapper untuk handle keydown enter manual
const onSearchKeydown = (event) => {
    if (event.key === 'Enter') {
        handleSearch();
    }
};

const handleSearch = () => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) {
        filteredProducts.value = products.value;
        return;
    }
    const exactMatch = products.value.find(p => {
        return p.units.some(u => u.barcode === query);
    });

    if (exactMatch) {
        const matchedUnit = exactMatch.units.find(u => u.barcode === query);
        addToCart(exactMatch, matchedUnit);
        searchQuery.value = ''; 
        filteredProducts.value = products.value; 
        toast.add({ severity: 'success', summary: 'Scan', detail: `${exactMatch.name} (${matchedUnit.unitName})`, life: 1500 });
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
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk tidak memiliki satuan', life: 3000 });
        return;
    }
    const priceInfo = product.prices.find(p => p.unitUuid === selectedUnit.uuid);
    const finalPrice = priceInfo ? priceInfo.price : 0;

    const existingItem = cart.value.find(item => item.productUuid === product.uuid && item.unitUuid === selectedUnit.uuid);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.value.push({
            productUuid: product.uuid,
            name: product.name,
            unitUuid: selectedUnit.uuid,
            unitName: selectedUnit.unitName,
            barcode: selectedUnit.barcode,
            price: finalPrice, 
            qty: 1,
            availableUnits: product.units,
            allPrices: product.prices 
        });
    }
};

const changeCartItemUnit = (item, newUnit) => {
    item.unitUuid = newUnit.uuid;
    item.unitName = newUnit.unitName;
    item.barcode = newUnit.barcode;
    const newPriceObj = item.allPrices.find(p => p.unitUuid === newUnit.uuid);
    item.price = newPriceObj ? newPriceObj.price : 0; 
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const processCheckout = async () => {
    if (!canCheckout.value) return;

    loading.value = true;
    try {
        const payload = {
            amount: grandTotal.value,
            details: {
                payment_method: 'CASH',
                payment_received: payment.amount,
                change: changeAmount.value,
                grand_total: grandTotal.value,
                total_items_count: cart.value.length 
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
        
        toast.add({ severity: 'success', summary: 'Transaksi Berhasil', detail: 'Kembalian: ' + formatCurrency(changeAmount.value), life: 5000 });
        
        cart.value = [];
        payment.amount = null;
        await loadProducts();

    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Transaksi gagal diproses', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const getStockLevelColor = (qty) => {
    if (qty <= 0) return 'bg-red-500';
    if (qty < 10) return 'bg-yellow-500';
    return 'bg-green-500';
};

onMounted(() => {
    loadProducts();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="flex flex-col lg:flex-row h-[calc(100vh-6rem)] gap-3 p-2 overflow-hidden bg-surface-100 dark:bg-surface-950">
        <Toast />

        <div class="flex-1 flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden min-w-[350px]">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 shrink-0">
                <IconField iconPosition="left" class="w-full">
                    <InputIcon class="pi pi-search text-primary-500" />
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Scan / Cari Produk..." 
                        class="w-full !text-base !py-2 !rounded-lg !border-none !bg-surface-100 dark:!bg-surface-800 focus:!ring-2 focus:!ring-primary-200" 
                        @keydown="onSearchKeydown" 
                        @input="handleSearch" 
                        autofocus
                    />
                </IconField>
            </div>
            <div class="flex-1 overflow-y-auto p-2 bg-surface-50 dark:bg-surface-950 scrollbar-hide">
                <div v-if="filteredProducts.length > 0" class="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    <div 
                        v-for="prod in filteredProducts" 
                        :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="cursor-pointer bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-3 rounded-xl hover:border-primary-500 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                        <div class="absolute left-0 top-0 bottom-0 w-1 transition-colors" 
                             :class="getStockLevelColor(prod.stock?.reduce((a,b)=>a+b.qty,0)||0)"></div>
                        
                        <div class="pl-2">
                            <div class="font-bold text-surface-800 dark:text-surface-100 text-xs mb-2 line-clamp-2 h-8 leading-snug group-hover:text-primary-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <div class="flex justify-between items-end mt-1">
                                <div class="flex flex-col">
                                    <span class="text-[9px] text-surface-400 uppercase font-bold tracking-wider">Stok</span>
                                    <span class="text-xs font-black" :class="(prod.stock?.reduce((a,b)=>a+b.qty,0)||0) > 0 ? 'text-surface-700 dark:text-surface-200' : 'text-red-500'">
                                        {{ prod.stock?.reduce((a,b)=>a+b.qty,0) || 0 }}
                                    </span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-[9px] text-surface-400 uppercase font-bold mb-0.5">
                                        {{ (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName || 'Unit' }}
                                    </span>
                                    <span class="font-black text-primary-600 text-sm bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">
                                        {{ 
                                            (() => {
                                                const defUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
                                                const price = prod.prices?.find(p => p.unitUuid === defUnit?.uuid)?.price || 0;
                                                return formatCurrency(price);
                                            })()
                                        }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 gap-2">
                    <div class="w-16 h-16 bg-surface-200 dark:bg-surface-800 rounded-full flex items-center justify-center">
                         <i class="pi pi-search text-3xl opacity-50"></i>
                    </div>
                    <p class="text-sm font-medium">Produk tidak ditemukan</p>
                </div>
            </div>
        </div>

        <div class="w-[400px] flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center bg-surface-50/50 dark:bg-surface-800 shrink-0">
                <h2 class="font-bold text-base text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <i class="pi pi-shopping-cart text-primary-500"></i>
                    Keranjang <span class="bg-primary-100 text-primary-700 text-[10px] px-1.5 py-0.5 rounded-full">{{ cart.length }}</span>
                </h2>
                <Button label="Reset" icon="pi pi-trash" text severity="danger" size="small" @click="cart = []" :disabled="cart.length === 0" class="!p-1 !text-xs !h-7" />
            </div>
            
            <div class="flex-1 overflow-y-auto p-0 scrollbar-thin bg-surface-50/30">
                <table class="w-full text-xs border-collapse">
                    <thead class="bg-surface-100 dark:bg-surface-800 sticky top-0 z-10 text-[10px] uppercase text-surface-500 font-bold tracking-wider border-b border-surface-200 dark:border-surface-700">
                        <tr>
                            <th class="p-2 text-left pl-3 font-bold">Item</th>
                            <th class="p-2 text-center w-14 font-bold">Qty</th>
                            <th class="p-2 text-right w-20 font-bold">Subtotal</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                        <tr v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" class="hover:bg-white dark:hover:bg-surface-800 transition-colors group">
                            <td class="p-2 pl-3 align-top">
                                <div class="font-bold text-surface-800 dark:text-surface-100 mb-1 line-clamp-1" :title="item.name">{{ item.name }}</div>
                                
                                <div class="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded p-0.5 w-fit border border-transparent focus-within:border-primary-300 transition-colors">
                                    <Dropdown 
                                        :modelValue="item.availableUnits.find(u => u.uuid === item.unitUuid)" 
                                        :options="item.availableUnits" 
                                        optionLabel="unitName"
                                        class="w-[65px] !h-6 text-[10px] !p-0 !border-none !shadow-none bg-transparent text-primary-700 font-bold"
                                        @update:modelValue="(val) => changeCartItemUnit(item, val)"
                                    >
                                         <template #value="slotProps">
                                            <div class="text-[10px] px-1">{{ slotProps.value.unitName }}</div>
                                        </template>
                                        <template #option="slotProps">
                                            <div class="text-[10px]">{{ slotProps.option.unitName }}</div>
                                        </template>
                                    </Dropdown>
                                    
                                    <div class="w-px h-3 bg-surface-300"></div>

                                    <InputNumber 
                                        v-model="item.price" 
                                        mode="currency" currency="IDR" locale="id-ID" 
                                        class="flex-1 !h-6 w-[80px]"
                                        inputClass="!text-[10px] !py-0 !px-1 !h-6 !text-right !font-mono text-surface-600 focus:text-primary-600 !bg-transparent border-none focus:ring-0"
                                        :min="0"
                                    />
                                </div>
                            </td>
                            <td class="p-2 text-center align-top pt-3">
                                <div class="flex flex-col items-center gap-0.5 bg-surface-100 dark:bg-surface-800 rounded py-0.5">
                                    <i class="pi pi-chevron-up text-[9px] cursor-pointer hover:text-primary-500 text-surface-400 p-0.5" @click="item.qty++"></i>
                                    <span class="text-xs font-bold text-surface-800">{{ item.qty }}</span>
                                    <i class="pi pi-chevron-down text-[9px] cursor-pointer hover:text-red-500 text-surface-400 p-0.5" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)"></i>
                                </div>
                            </td>
                            <td class="p-2 text-right align-top pt-3 font-bold text-surface-900 dark:text-surface-0 text-[11px]">
                                {{ formatCurrency(item.price * item.qty) }}
                            </td>
                            <td class="p-2 text-center align-top pt-3">
                                <button class="text-surface-300 hover:text-red-500 transition-colors p-1" @click="removeFromCart(index)">
                                    <i class="pi pi-times text-[10px]"></i>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <div v-if="cart.length === 0" class="h-40 flex flex-col items-center justify-center text-surface-300 gap-2">
                    <i class="pi pi-shopping-cart text-4xl opacity-20"></i>
                    <p class="text-xs font-medium text-surface-400">Keranjang kosong</p>
                </div>
            </div>

             <div class="p-3 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 shrink-0 flex justify-between items-end">
                <span class="text-xs font-bold text-surface-500 uppercase tracking-wide mb-1">Total</span>
                <span class="text-xl font-black text-primary-600 tracking-tight">{{ formatCurrency(grandTotal) }}</span>
            </div>
        </div>

        <div class="w-[280px] flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            
            <div class="flex-1 p-3 flex flex-col gap-4 overflow-y-auto scrollbar-thin bg-surface-50/30">
                <div>
                    <label class="text-[10px] font-bold uppercase text-surface-400 mb-1.5 block tracking-widest flex justify-between">
                        <span>Bayar Tunai</span>
                        <i class="pi pi-money-bill text-green-500"></i>
                    </label>
                    <InputNumber 
                        v-model="payment.amount" 
                        mode="currency" currency="IDR" locale="id-ID" 
                        class="w-full" 
                        inputClass="!text-2xl !font-bold !text-center !py-4 !rounded-xl !bg-white dark:!bg-surface-800 !border-surface-200 focus:!border-primary-500 !shadow-sm !text-surface-800" 
                        placeholder="Rp 0" :min="0" autofocus
                    />
                    
                    <div class="grid grid-cols-2 gap-2 mt-3">
                        <button class="py-2 px-1 bg-white border border-surface-200 hover:border-primary-300 hover:bg-primary-50 rounded-lg text-[10px] font-bold text-surface-600 transition-all shadow-sm" @click="payment.amount = grandTotal">
                            Uang Pas
                        </button>
                        <button class="py-2 px-1 bg-white border border-surface-200 hover:border-primary-300 hover:bg-primary-50 rounded-lg text-[10px] font-bold text-surface-600 transition-all shadow-sm" @click="payment.amount = 50000">
                            50.000
                        </button>
                        <button class="py-2 px-1 bg-white border border-surface-200 hover:border-primary-300 hover:bg-primary-50 rounded-lg text-[10px] font-bold text-surface-600 transition-all shadow-sm" @click="payment.amount = 100000">
                            100.000
                        </button>
                        <button class="py-2 px-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition-colors border border-red-100" @click="payment.amount = null">
                            <i class="pi pi-times mr-1"></i> Clear
                        </button>
                    </div>
                </div>
                
                <div class="mt-auto bg-surface-900 text-white p-4 rounded-xl text-center shadow-lg relative overflow-hidden group ring-1 ring-black/5">
                    <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div class="absolute inset-0 bg-gradient-to-br from-surface-800 to-black opacity-80"></div>
                    
                    <div class="relative z-10">
                        <span class="text-[9px] uppercase tracking-[0.2em] opacity-60 block mb-1 font-medium">Kembalian</span>
                        <span class="text-2xl font-mono font-bold tracking-tight block" :class="changeAmount < 0 ? 'text-red-400' : 'text-emerald-400'">
                            {{ formatCurrency(Math.max(0, changeAmount)) }}
                        </span>
                        
                        <div v-if="changeAmount < 0" class="mt-2 inline-flex items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded text-[10px] text-red-300 border border-red-500/30">
                            <i class="pi pi-info-circle text-[9px]"></i>
                            Kurang {{ formatCurrency(Math.abs(changeAmount)) }}
                        </div>
                        <div v-else-if="changeAmount >= 0 && payment.amount > 0" class="mt-2 inline-flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-300 border border-emerald-500/30">
                            <i class="pi pi-check-circle text-[9px]"></i>
                            Lunas
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-3 border-t border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 shrink-0">
                <Button 
                    label="BAYAR SEKARANG" 
                    icon="pi pi-print" 
                    class="w-full font-black py-3 text-sm shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all transform active:scale-95" 
                    :disabled="!canCheckout" 
                    :loading="loading"
                    @click="processCheckout"
                    severity="success"
                    rounded
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Modern Scrollbar */
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Hide scrollbar for cleaner look in grid */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>