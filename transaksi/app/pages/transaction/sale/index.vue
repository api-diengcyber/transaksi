<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProductCreateModal from '~/components/ProductCreateModal.vue';

const productService = useProductService();
const journalService = useJournalService();
const toast = useToast();

// --- STATE ---
const products = ref([]);
const filteredProducts = ref([]);
const cart = ref([]);
const searchQuery = ref('');
const loading = ref(true);
const showCreateModal = ref(false);

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

const onSearchKeydown = (event) => {
    if (event.key === 'Enter') handleSearch();
};

const loadProducts = async () => {
    loading.value = true;
    try {
        const data = await productService.getAllProducts();
        // Normalisasi Data
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

    // 1. Cari Exact Match Barcode di Level UNIT
    // Ini memungkinkan scan barcode "DUS" langsung masuk sebagai "DUS"
    const exactProduct = products.value.find(p => p.units.some(u => u.barcode === query));

    if (exactProduct) {
        const matchedUnit = exactProduct.units.find(u => u.barcode === query);
        addToCart(exactProduct, matchedUnit);
        
        searchQuery.value = ''; 
        filteredProducts.value = products.value; 
        toast.add({ severity: 'success', summary: 'Scan', detail: `${exactProduct.name} (${matchedUnit.unitName})`, life: 1500 });
    } else {
        // 2. Filter Manual (Nama Produk)
        filteredProducts.value = products.value.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.units.some(u => u.barcode?.includes(query))
        );
    }
};

const addToCart = (product, specificUnit = null) => {
    // Tentukan Unit: Jika scan, pakai unit spesifik. Jika klik, pakai Default/Pertama.
    let selectedUnit = specificUnit;
    if (!selectedUnit) {
        selectedUnit = product.units.find(u => u.uuid === product.defaultUnitUuid) || product.units[0];
    }

    if (!selectedUnit) {
        toast.add({ severity: 'warn', summary: 'Gagal', detail: 'Produk error (tanpa satuan)', life: 3000 });
        return;
    }

    // Tentukan Harga Awal: Cari harga 'Umum' untuk unit ini, atau harga pertama yg ketemu
    const unitPrices = product.prices.filter(p => p.unitUuid === selectedUnit.uuid);
    // Prioritas: Harga default -> Harga bernama 'Umum' -> Harga pertama -> 0
    const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    const finalPrice = defaultPriceObj ? defaultPriceObj.price : 0;

    // Cek apakah item identik (Produk sama + Unit sama) sudah ada di cart
    const existingItem = cart.value.find(item => item.productUuid === product.uuid && item.unitUuid === selectedUnit.uuid);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.value.push({
            // Identitas Produk
            productUuid: product.uuid,
            name: product.name,
            
            // Data Transaksi Aktif
            unitUuid: selectedUnit.uuid,
            unitName: selectedUnit.unitName,
            price: finalPrice, // Harga yang bisa di-custom
            qty: 1,
            selectedPriceObj: defaultPriceObj, // Untuk tracking dropdown harga
            
            // Referensi Data Master (Untuk Dropdown)
            availableUnits: product.units,
            allPrices: product.prices 
        });
    }
};

// Ganti Satuan di Cart -> Reset Harga ke Default Unit tsb
const changeCartItemUnit = (item, newUnitUuid) => {
    const newUnit = item.availableUnits.find(u => u.uuid === newUnitUuid);
    if (!newUnit) return;

    item.unitUuid = newUnit.uuid;
    item.unitName = newUnit.unitName;
    
    // Cari harga default untuk unit baru ini
    const unitPrices = item.allPrices.filter(p => p.unitUuid === newUnit.uuid);
    const defaultPriceObj = unitPrices.find(p => p.isDefault) || unitPrices.find(p => p.name === 'Umum') || unitPrices[0];
    
    item.selectedPriceObj = defaultPriceObj;
    item.price = defaultPriceObj ? defaultPriceObj.price : 0;
};

// Ganti Tier Harga (Umum -> Grosir) -> Update Nominal
const changeCartItemPriceTier = (item, newPriceObj) => {
    item.selectedPriceObj = newPriceObj;
    item.price = newPriceObj.price;
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

// Callback Product Created
const onProductCreated = async (newProduct) => {
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) {
        addToCart(fullProduct);
        toast.add({ severity: 'info', summary: 'Info', detail: 'Produk baru masuk keranjang', life: 3000 });
    }
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
                total_items_count: cart.value.length,
                grand_total: grandTotal.value
            }
        };

        // Mapping Flat Key untuk Backend
        cart.value.forEach((item, index) => {
            payload.details[`product_uuid#${index}`] = item.productUuid;
            payload.details[`unit_uuid#${index}`] = item.unitUuid;
            payload.details[`qty#${index}`] = item.qty;
            payload.details[`price#${index}`] = item.price; // Harga final (bisa custom)
            payload.details[`subtotal#${index}`] = item.qty * item.price;
        });

        await journalService.createSaleTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Kembalian: ' + formatCurrency(changeAmount.value), life: 5000 });
        
        cart.value = [];
        payment.amount = null;
        await loadProducts(); 

    } catch (e) {
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
    <div class="flex flex-col lg:flex-row h-[calc(100vh-5rem)] gap-3 p-2 overflow-hidden bg-surface-100 dark:bg-surface-950">
        <Toast />

        <div class="flex-1 flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden min-w-[350px]">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 bg-blue-50/50 dark:bg-blue-900/10">
                <div class="flex justify-between items-center mb-2">
                    <div class="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                        <i class="pi pi-box"></i> Katalog
                    </div>
                    <Button label="Baru" icon="pi pi-plus" size="small" class="!py-1 !px-2 !text-xs" @click="showCreateModal = true" />
                </div>
                
                <IconField iconPosition="left" class="w-full">
                    <InputIcon class="pi pi-search text-primary-500 text-xs" />
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Scan Barcode / Cari..." 
                        class="w-full !text-sm !h-9 !rounded-lg" 
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
                            <div class="font-bold text-surface-800 dark:text-surface-100 text-xs mb-2 line-clamp-2 h-8 leading-snug group-hover:text-blue-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <div class="flex justify-between items-end">
                                <div class="flex flex-col">
                                    <span class="text-[9px] text-surface-400 uppercase font-bold tracking-wider">Stok</span>
                                    <span class="text-xs font-black" :class="(prod.stock?.reduce((a,b)=>a+b.qty,0)||0) > 0 ? 'text-surface-700 dark:text-surface-200' : 'text-red-500'">
                                        {{ prod.stock?.reduce((a,b)=>a+b.qty,0) || 0 }}
                                    </span>
                                </div>
                                <div class="flex flex-col items-end">
                                    <span class="text-[9px] text-surface-400 uppercase font-bold mb-0.5">
                                        {{ (prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0])?.unitName }}
                                    </span>
                                    <span class="font-black text-primary-600 text-sm bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">
                                        {{ 
                                            (() => {
                                                const defUnit = prod.units.find(u => u.uuid === prod.defaultUnitUuid) || prod.units[0];
                                                const defPrice = prod.prices?.find(p => p.unitUuid === defUnit?.uuid && (p.isDefault || p.name === 'Umum')) || prod.prices?.[0];
                                                return formatCurrency(defPrice?.price || 0);
                                            })()
                                        }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 gap-3">
                    <i class="pi pi-box text-3xl opacity-30"></i>
                    <p class="text-xs">Produk tidak ditemukan</p>
                    <Button label="Buat Produk Baru" size="small" outlined @click="showCreateModal = true" />
                </div>
            </div>
        </div>

        <div class="w-[450px] flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
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
                            <th class="p-2 text-left pl-3 w-[45%]">Item</th>
                            <th class="p-2 text-center w-14 font-bold">Qty</th>
                            <th class="p-2 text-right w-20 font-bold">Subtotal</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                        <tr v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" class="hover:bg-white dark:hover:bg-surface-800 transition-colors group">
                            <td class="p-2 pl-3 align-top">
                                <div class="font-bold text-surface-800 dark:text-surface-100 mb-1 line-clamp-1" :title="item.name">{{ item.name }}</div>
                                
                                <div class="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded p-0.5 w-full border border-transparent focus-within:border-primary-300 transition-colors">
                                    
                                    <Dropdown 
                                        v-model="item.unitUuid"
                                        :options="item.availableUnits" 
                                        optionLabel="unitName"
                                        optionValue="uuid"
                                        class="w-[65px] !h-6 text-[10px] !p-0 !border-none !shadow-none bg-transparent text-primary-700 font-bold"
                                        @change="(e) => changeCartItemUnit(item, e.value)"
                                    >
                                         <template #value="slotProps">
                                            <div class="text-[10px] px-1">{{ slotProps.value?.unitName || 'Unit' }}</div>
                                        </template>
                                    </Dropdown>
                                    
                                    <div class="w-px h-3 bg-surface-300"></div>

                                    <Dropdown 
                                        v-model="item.selectedPriceObj"
                                        :options="item.allPrices.filter(p => p.unitUuid === item.unitUuid)"
                                        optionLabel="name"
                                        class="flex-1 !h-6 text-[10px] !p-0 !border-none !shadow-none bg-transparent min-w-[50px]"
                                        placeholder="Custom"
                                        @change="(e) => changeCartItemPriceTier(item, e.value)"
                                    >
                                        <template #value="slotProps">
                                            <div class="text-[10px] px-1 truncate">{{ slotProps.value ? slotProps.value.name : 'Custom' }}</div>
                                        </template>
                                        <template #option="slotProps">
                                            <div class="text-[10px] flex justify-between w-full gap-2">
                                                <span>{{ slotProps.option.name }}</span>
                                                <span class="font-bold">{{ formatCurrency(slotProps.option.price) }}</span>
                                            </div>
                                        </template>
                                    </Dropdown>

                                    <div class="w-px h-3 bg-surface-300"></div>

                                    <InputNumber 
                                        v-model="item.price" 
                                        mode="currency" currency="IDR" locale="id-ID" 
                                        class="w-[75px] !h-6"
                                        inputClass="!text-[10px] !py-0 !px-1 !h-6 !text-right !font-mono text-surface-600 focus:text-primary-600 !bg-transparent border-none focus:ring-0"
                                        :min="0"
                                        v-tooltip.bottom="'Edit Harga Manual'"
                                        @input="item.selectedPriceObj = null" 
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

        <ProductCreateModal 
            v-model:visible="showCreateModal" 
            @product-created="onProductCreated" 
        />

    </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/* Dropdown PrimeVue Compact */
:deep(.custom-dropdown .p-dropdown-label) {
    padding: 2px 6px !important;
}
</style>