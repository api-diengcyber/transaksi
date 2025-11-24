<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Import komponen laporan list AR/AP yang telah dibuat
import ReportArapList from '~/components/ReportArapList.vue'; 

const route = useRoute();
const router = useRouter();

// State Tab (default: piutang)
const activeTab = ref(route.query.tab || 'piutang');

// Refs untuk memanggil fungsi refresh dari komponen anak
// Karena menggunakan 1 komponen dengan prop, kita perlu 2 ref untuk 2 instance
const arRef = ref(null);
const apRef = ref(null);

// --- UTILS ---
const getTabClass = (tabName) => {
    // Menggunakan kelas global-tab-active dan global-tab-inactive dari base.css
    return activeTab.value === tabName
        ? 'global-tab-active'
        : 'global-tab-inactive';
};

// --- LOGIC ---
// Sinkronisasi Tab dengan URL
watch(activeTab, (newTab) => {
    router.replace({ query: { tab: newTab } });
});

// Panggil refresh saat tab berubah (URL Query berubah) dan komponen sudah dimuat
watch(() => route.query.tab, async (newTab) => {
    activeTab.value = newTab || 'piutang';
    
    await nextTick();
    
    // Logic refresh data di tab yang aktif
    if (activeTab.value === 'piutang' && arRef.value && arRef.value.refreshData) {
        arRef.value.refreshData();
    } else if (activeTab.value === 'hutang' && apRef.value && apRef.value.refreshData) {
        apRef.value.refreshData();
    }
});

onMounted(() => {
    // Memastikan activeTab sync dengan URL saat pertama kali dimuat
    activeTab.value = route.query.tab || 'piutang';
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="h-full flex flex-col">
        
        <div class="flex items-center justify-between mb-4">
             <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Laporan Piutang & Hutang</h1>
             <div class="flex items-center gap-2">
                <Button 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    outlined 
                    size="small" 
                    v-tooltip.left="'Refresh Data'" 
                    @click="activeTab === 'piutang' ? arRef.refreshData() : apRef.refreshData()" 
                />
             </div>
        </div>

        <div class="flex items-end gap-3 mb-4 border-b border-surface-200 dark:border-surface-700">
            <button 
                @click="activeTab = 'piutang'"
                :class="getTabClass('piutang')"
            >
                <i class="pi pi-arrow-up-right mr-2"></i> Piutang (AR)
            </button>
            <button 
                @click="activeTab = 'hutang'"
                :class="getTabClass('hutang')"
            >
                <i class="pi pi-arrow-down-left mr-2"></i> Hutang (AP)
            </button>
        </div>
        
        <div class="flex-1 overflow-hidden">
            <KeepAlive>
                <ReportArapList
                    v-if="activeTab === 'piutang'" 
                    ref="arRef"
                    type="AR"
                    class="h-full"
                />
                <ReportArapList 
                    v-else-if="activeTab === 'hutang'" 
                    ref="apRef"
                    type="AP"
                    class="h-full"
                />
            </KeepAlive>
        </div>
    </div>
</template>