<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
// Import komponen transaksi
import TransactionSale from '~/components/transaction/TransactionSale.vue';
import TransactionBuy from '~/components/transaction/TransactionBuy.vue';
import TransactionReturn from '~/components/transaction/TransactionReturn.vue'; 
import ProductCreateModal from '~/components/product/ProductCreateModal.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// Ref untuk memanggil fungsi refresh dari komponen anak
const saleRef = ref(null);
const buyRef = ref(null);
const returnRef = ref(null); 
const debtPaymentRef = ref(null);
const globalDebtRef = ref(null); // [BARU]

// State Modal Produk
const showModal = ref(false);

// State Tab
// [UPDATE] Tambah 'global-debt' dan 'debt-payment'
const activeTab = ref(route.query.tab === 'buy' ? 'buy' : route.query.tab === 'return' ? 'return' : route.query.tab === 'global-debt' ? 'global-debt' : route.query.tab === 'debt-payment' ? 'debt-payment' : 'sale'); 

// --- UTILS ---
const getTabClass = (tabName) => {
    return activeTab.value === tabName
        ? 'global-tab-active'
        : 'global-tab-inactive';
};

// Panggil refresh saat tab berubah dan komponen sudah dimuat
watch(() => route.query.tab, async (newTab) => {
    activeTab.value = newTab === 'buy' ? 'buy' : newTab === 'return' ? 'return' : newTab === 'global-debt' ? 'global-debt' : newTab === 'debt-payment' ? 'debt-payment' : 'sale'; // [UPDATE] Logika tab
    
    await nextTick();
    
    // [UPDATE] Tambahkan logic refresh untuk semua tab terkait
    if (activeTab.value === 'sale' && saleRef.value && saleRef.value.refreshData) {
        saleRef.value.refreshData();
    } else if (activeTab.value === 'buy' && buyRef.value && buyRef.value.refreshData) {
        buyRef.value.refreshData();
    } else if (activeTab.value === 'return' && returnRef.value && returnRef.value.refreshData) {
        returnRef.value.refreshData();
    } else if (activeTab.value === 'debt-payment' && debtPaymentRef.value && debtPaymentRef.value.refreshData) {
        debtPaymentRef.value.refreshData();
    } else if (activeTab.value === 'global-debt' && globalDebtRef.value && globalDebtRef.value.refreshData) {
        globalDebtRef.value.refreshData();
    }
});

const onProductCreated = (newProduct) => {
    toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk baru berhasil dibuat!', life: 3000 });
    // Trigger refresh pada tab yang aktif jika relevan
    if (activeTab.value === 'sale' && saleRef.value) {
        saleRef.value.refreshData(newProduct);
    } else if (activeTab.value === 'buy' && buyRef.value) {
        buyRef.value.refreshData(newProduct);
    } 
    
    showModal.value = false;
};

const handleOpenCreateModal = () => {
    showModal.value = true;
};

onMounted(() => {
    activeTab.value = route.query.tab === 'buy' ? 'buy' : route.query.tab === 'return' ? 'return' : route.query.tab === 'global-debt' ? 'global-debt' : route.query.tab === 'debt-payment' ? 'debt-payment' : 'sale'; // [UPDATE] Default tab
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="h-[calc(100vh-5rem)]">
        <Toast />
        
        <div class="h-full flex flex-col">
            <div class="flex items-end gap-3 mb-4 border-b border-surface-200 dark:border-surface-700">
                
                <button 
                    @click="activeTab = 'sale'"
                    :class="getTabClass('sale')"
                >
                    <i class="pi pi-shopping-cart mr-2"></i> Penjualan
                </button>
                <button 
                    @click="activeTab = 'buy'"
                    :class="getTabClass('buy')"
                >
                    <i class="pi pi-truck mr-2"></i> Pembelian
                </button>
                <button 
                    @click="activeTab = 'return'"
                    :class="getTabClass('return')"
                >
                    <i class="pi pi-refresh mr-2"></i> Retur Barang
                </button>
            </div>
            
            <div class="flex-1 overflow-hidden">
                <KeepAlive>
                    <TransactionSale 
                        v-if="activeTab === 'sale'" 
                        ref="saleRef"
                        @open-create-modal="handleOpenCreateModal"
                        class="h-full"
                    />
                    <TransactionBuy 
                        v-else-if="activeTab === 'buy'" 
                        ref="buyRef"
                        @open-create-modal="handleOpenCreateModal"
                        class="h-full"
                    />
                    <TransactionReturn 
                        v-else-if="activeTab === 'return'" 
                        ref="returnRef"
                        class="h-full"
                    />
                </KeepAlive>
            </div>
        </div>

        <ProductCreateModal 
            v-model:visible="showModal" 
            :productUuid="null" 
            @product-created="onProductCreated" 
        />
    </div>
</template>