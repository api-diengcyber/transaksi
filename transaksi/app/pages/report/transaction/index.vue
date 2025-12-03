<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Import komponen laporan baru
import ReportSale from '~/components/ReportSale.vue';
import ReportBuy from '~/components/ReportBuy.vue';
import ReportReturn from '~/components/ReportReturn.vue';
import ReportGraph from '~/components/ReportGraph.vue';

const route = useRoute();
const router = useRouter();

// State Tab (default: sale)
const activeTab = ref(route.query.tab || 'sale');

// Refs untuk memanggil fungsi refresh dari komponen anak
const saleRef = ref(null);
const buyRef = ref(null);
const returnRef = ref(null);
const graphRef = ref(null);

// --- UTILS ---
const getTabClass = (tabName) => {
    return activeTab.value === tabName
        ? 'global-tab-active'
        : 'global-tab-inactive';
};

// --- LOGIC ---
// Sinkronisasi Tab dengan URL
watch(activeTab, (newTab) => {
    router.replace({ query: { tab: newTab } });
});

// Panggil refresh saat tab berubah dan komponen sudah dimuat
watch(() => route.query.tab, async (newTab) => {
    activeTab.value = newTab || 'sale';
    
    await nextTick();
    
    // Logic refresh data di tab yang aktif
    if (activeTab.value === 'sale' && saleRef.value && saleRef.value.refreshData) {
        saleRef.value.refreshData();
    } else if (activeTab.value === 'buy' && buyRef.value && buyRef.value.refreshData) {
        buyRef.value.refreshData();
    } else if (activeTab.value === 'return' && returnRef.value && returnRef.value.refreshData) {
        returnRef.value.refreshData();
    } else if (activeTab.value === 'graph' && graphRef.value && graphRef.value.refreshData) {
        graphRef.value.refreshData();
    }
});

onMounted(() => {
    activeTab.value = route.query.tab || 'sale';
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="h-full flex flex-col">
        
        <div class="flex items-center justify-between mb-4">
             <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Laporan & Analisis</h1>
             <div class="flex items-center gap-2">
                <Button 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    outlined 
                    size="small" 
                    v-tooltip.left="'Refresh Data'" 
                    @click="activeTab === 'sale' ? saleRef.refreshData() : activeTab === 'buy' ? buyRef.refreshData() : graphRef.refreshData()" 
                />
             </div>
        </div>

        <div class="flex items-end gap-3 mb-4 border-b border-surface-200 dark:border-surface-700">
            <button 
                @click="activeTab = 'sale'"
                :class="getTabClass('sale')"
            >
                <i class="pi pi-file-pdf mr-2"></i> Penjualan
            </button>
            <button 
                @click="activeTab = 'buy'"
                :class="getTabClass('buy')"
            >
                <i class="pi pi-shopping-bag mr-2"></i> Pembelian
            </button>
            <button 
                @click="activeTab = 'return'"
                :class="getTabClass('return')"
            >
                <i class="pi pi-shopping-bag mr-2"></i> Retur Barang
            </button>
            <button 
                @click="activeTab = 'graph'"
                :class="getTabClass('graph')"
            >
                <i class="pi pi-chart-line mr-2"></i> Analisis Grafik
            </button>
        </div>
        
        <div class="flex-1 overflow-hidden">
            <KeepAlive>
                <ReportSale 
                    v-if="activeTab === 'sale'" 
                    ref="saleRef"
                    class="h-full"
                />
                <ReportBuy 
                    v-else-if="activeTab === 'buy'" 
                    ref="buyRef"
                    class="h-full"
                />
                <ReportReturn 
                    v-else-if="activeTab === 'return'" 
                    ref="returnRef"
                    class="h-full"
                />
                <ReportGraph 
                    v-else-if="activeTab === 'graph'" 
                    ref="graphRef"
                    class="h-full"
                />
            </KeepAlive>
        </div>
    </div>
</template>