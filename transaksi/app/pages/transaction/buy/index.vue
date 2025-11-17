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

const purchaseInfo = reactive({
    supplier: '',
    referenceNo: '', 
    notes: ''
});

// --- COMPUTED ---
const grandTotal = computed(() => {
    return cart.value.reduce((total, item) => {
        return total + (item.buyPrice * item.qty);
    }, 0);
});

const canCheckout = computed(() => {
    return cart.value.length > 0 && grandTotal.value > 0;
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
            stock: p.stock || []
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
    const exactMatch = products.value.find(p => p.units.some(u => u.barcode === query));
    if (exactMatch) {
        const matchedUnit = exactMatch.units.find(u => u.barcode === query);
        addToCart(exactMatch, matchedUnit);
        searchQuery.value = ''; 
        filteredProducts.value = products.value; 
        toast.add({ severity: 'success', summary: 'Scan', detail: `${exactMatch.name} ditambahkan`, life: 1500 });
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
            buyPrice: 0, 
            qty: 1,
            availableUnits: product.units,
            sellingPrice: product.prices.find(p => p.unitUuid === selectedUnit.uuid)?.price || 0
        });
    }
};

const changeCartItemUnit = (item, newUnit) => {
    item.unitUuid = newUnit.uuid;
    item.unitName = newUnit.unitName;
    item.barcode = newUnit.barcode;
};

const removeFromCart = (index) => {
    cart.value.splice(index, 1);
};

const onProductCreated = async (newProduct) => {
    await loadProducts();
    const fullProduct = products.value.find(p => p.uuid === newProduct.uuid);
    if (fullProduct) {
        addToCart(fullProduct);
        toast.add({ severity: 'info', summary: 'Info', detail: 'Produk baru masuk keranjang', life: 3000 });
    }
};

const processPurchase = async () => {
    if (!canCheckout.value) return;

    loading.value = true;
    try {
        const payload = {
            details: {
                grand_total: grandTotal.value,
                supplier: purchaseInfo.supplier || 'Umum',
                reference_no: purchaseInfo.referenceNo || '-',
                notes: purchaseInfo.notes,
                total_items_count: cart.value.length 
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
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Stok berhasil ditambahkan', life: 3000 });
        
        cart.value = [];
        purchaseInfo.supplier = '';
        purchaseInfo.referenceNo = '';
        purchaseInfo.notes = '';
        await loadProducts(); 

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Transaksi gagal disimpan', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
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
                        <i class="pi pi-box"></i> Katalog Barang
                    </div>
                    <Button label="Baru" icon="pi pi-plus" size="small" class="!py-1 !px-2 !text-xs" @click="showCreateModal = true" />
                </div>
                
                <IconField iconPosition="left" class="w-full">
                    <InputIcon class="pi pi-search text-primary-500 text-xs" />
                    <InputText 
                        v-model="searchQuery" 
                        placeholder="Scan Barcode / Cari Nama..." 
                        class="w-full !text-sm !h-9 !rounded-lg" 
                        @keydown="onSearchKeydown" 
                        @input="handleSearch" 
                    />
                </IconField>
            </div>
            
            <div class="flex-1 overflow-y-auto p-2 bg-surface-50 dark:bg-surface-950 scrollbar-hide">
                <div v-if="filteredProducts.length > 0" class="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    <div 
                        v-for="prod in filteredProducts" 
                        :key="prod.uuid"
                        @click="addToCart(prod)"
                        class="cursor-pointer bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 p-3 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                         <div class="absolute left-0 top-0 bottom-0 w-1 transition-colors" 
                            :class="(prod.stock?.reduce((a,b)=>a+b.qty,0)||0) > 0 ? 'bg-green-500' : 'bg-red-500'"></div>

                        <div class="pl-2">
                            <div class="font-bold text-surface-800 dark:text-surface-100 text-xs mb-2 line-clamp-2 h-8 leading-snug group-hover:text-blue-600 transition-colors">
                                {{ prod.name }}
                            </div>
                            <div class="flex justify-between items-end">
                                <div class="flex flex-col">
                                    <span class="text-[9px] text-surface-400 uppercase font-bold tracking-wider">Sisa Stok</span>
                                    <span class="text-xs font-black" :class="(prod.stock?.reduce((a,b)=>a+b.qty,0)||0) > 0 ? 'text-surface-700 dark:text-surface-200' : 'text-red-500'">
                                        {{ prod.stock?.reduce((a,b)=>a+b.qty,0) || 0 }}
                                    </span>
                                </div>
                                <div class="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full font-bold flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <i class="pi pi-plus text-[9px]"></i> Tambah
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="h-full flex flex-col items-center justify-center text-surface-400 gap-3">
                    <div class="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                         <i class="pi pi-search text-3xl opacity-30"></i>
                    </div>
                    <p class="text-xs">Produk tidak ditemukan</p>
                    <Button label="Buat Produk Baru" size="small" outlined @click="showCreateModal = true" />
                </div>
            </div>
        </div>

        <div class="w-[450px] flex flex-col bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            <div class="p-3 border-b border-surface-100 dark:border-surface-700 flex justify-between items-center bg-orange-50/50 dark:bg-orange-900/10 shrink-0">
                <div class="flex items-center gap-2">
                    <i class="pi pi-truck text-orange-500"></i>
                    <span class="text-xs font-bold text-orange-700 uppercase tracking-wide">Barang Masuk</span>
                    <span class="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{{ cart.length }}</span>
                </div>
                <Button label="Reset" icon="pi pi-trash" text severity="danger" size="small" @click="cart = []" :disabled="cart.length === 0" class="!text-xs !p-1 !h-7" />
            </div>
            
            <div class="flex-1 overflow-y-auto p-0 scrollbar-thin bg-surface-50/30">
                <table class="w-full text-xs border-collapse">
                    <thead class="bg-surface-100 dark:bg-surface-800 sticky top-0 z-10 text-[10px] uppercase text-surface-500 font-bold tracking-wider border-b border-surface-200 dark:border-surface-700">
                        <tr>
                            <th class="p-2 text-left pl-3 w-[45%]">Item</th>
                            <th class="p-2 text-center w-14">Qty</th>
                            <th class="p-2 text-right w-[30%]">Harga Beli</th>
                            <th class="p-2 w-6"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                        <tr v-for="(item, index) in cart" :key="index + '_' + item.unitUuid" class="hover:bg-white dark:hover:bg-surface-800 transition-colors group">
                            <td class="p-2 pl-3 align-top">
                                <div class="font-bold text-surface-800 dark:text-surface-100 mb-1 line-clamp-1" :title="item.name">{{ item.name }}</div>
                                <Dropdown 
                                    v-model="item.unitUuid"
                                    :options="item.availableUnits" 
                                    optionLabel="unitName"
                                    optionValue="uuid"
                                    class="w-full !h-6 text-[10px] !p-0 !border-surface-200 bg-white"
                                    @change="(e) => {
                                        const unit = item.availableUnits.find(u => u.uuid === e.value);
                                        changeCartItemUnit(item, unit);
                                    }"
                                />
                            </td>
                            <td class="p-2 align-top text-center">
                                <div class="flex flex-col items-center gap-0.5 bg-surface-100 dark:bg-surface-800 rounded py-0.5">
                                    <i class="pi pi-chevron-up text-[9px] cursor-pointer hover:text-primary-500 text-surface-400 p-0.5" @click="item.qty++"></i>
                                    <span class="text-xs font-bold text-surface-800">{{ item.qty }}</span>
                                    <i class="pi pi-chevron-down text-[9px] cursor-pointer hover:text-red-500 text-surface-400 p-0.5" @click="item.qty > 1 ? item.qty-- : removeFromCart(index)"></i>
                                </div>
                            </td>
                            <td class="p-2 align-top text-right">
                                <InputNumber 
                                    v-model="item.buyPrice" 
                                    mode="currency" currency="IDR" locale="id-ID" 
                                    class="w-full !h-7"
                                    inputClass="!text-[11px] !py-1 !px-1 !text-right font-bold text-orange-600 bg-transparent border-none focus:ring-0"
                                    placeholder="Rp 0"
                                    :min="0"
                                />
                                <div class="text-[9px] text-surface-400 mt-1 font-mono border-t border-dashed border-surface-200 pt-1">
                                    {{ formatCurrency(item.buyPrice * item.qty) }}
                                </div>
                            </td>
                            <td class="p-2 text-center align-middle">
                                <button class="text-surface-300 hover:text-red-500 transition-colors p-1" @click="removeFromCart(index)">
                                    <i class="pi pi-times text-[10px]"></i>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <div v-if="cart.length === 0" class="h-40 flex flex-col items-center justify-center text-surface-300 gap-2">
                    <i class="pi pi-truck text-4xl opacity-20"></i>
                    <p class="text-xs font-medium text-surface-400">Belum ada barang masuk</p>
                </div>
            </div>
        </div>

        <div class="w-[300px] flex flex-col bg-surface-50 dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 h-full overflow-hidden">
            
            <div class="p-4 bg-white dark:bg-surface-900 m-2 rounded-xl border border-surface-100 shadow-sm">
                <span class="text-[10px] text-surface-500 uppercase tracking-widest font-bold block mb-1">Total Belanja</span>
                <span class="text-2xl font-mono font-black text-orange-600 tracking-tight block">{{ formatCurrency(grandTotal) }}</span>
            </div>

            <div class="flex-1 p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
                <div class="text-[10px] font-bold text-surface-400 uppercase tracking-widest border-b border-surface-200 pb-1 mb-1">Data Supplier</div>
                
                <div>
                    <label class="text-[10px] text-surface-600 font-bold block mb-1">Nama Supplier</label>
                    <div class="relative">
                        <i class="pi pi-user absolute left-2 top-2.5 text-surface-400 text-xs"></i>
                        <InputText v-model="purchaseInfo.supplier" placeholder="Contoh: Toko Makmur" class="w-full !text-xs !py-2 !pl-7 !rounded-lg" />
                    </div>
                </div>

                <div>
                    <label class="text-[10px] text-surface-600 font-bold block mb-1">No. Nota / Referensi</label>
                    <div class="relative">
                        <i class="pi pi-receipt absolute left-2 top-2.5 text-surface-400 text-xs"></i>
                        <InputText v-model="purchaseInfo.referenceNo" placeholder="INV-2025-..." class="w-full !text-xs !py-2 !pl-7 !rounded-lg" />
                    </div>
                </div>

                <div>
                    <label class="text-[10px] text-surface-600 font-bold block mb-1">Catatan</label>
                    <Textarea v-model="purchaseInfo.notes" rows="3" class="w-full !text-xs !rounded-lg" placeholder="Keterangan tambahan..." />
                </div>
            </div>

            <div class="p-3 border-t border-surface-200 bg-white dark:bg-surface-900 shrink-0">
                <Button 
                    label="SIMPAN DATA" 
                    icon="pi pi-save" 
                    severity="warning"
                    class="w-full font-bold py-3 text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all transform active:scale-95" 
                    :disabled="!canCheckout" 
                    :loading="loading"
                    @click="processPurchase"
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
</style>