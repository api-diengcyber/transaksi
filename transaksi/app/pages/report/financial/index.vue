<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import ProfitLossTab from '~/components/financial/ProfitLossTab.vue';
import BalanceSheetTab from '~/components/financial/BalanceSheetTab.vue';
import { useAccountService } from '#imports';
import { useRouter } from 'vue-router';

const router = useRouter();

const accountService = useAccountService(); 
const toast = useToast();

const loading = ref(false);
const rawData = ref<any>([]);
const activeTab = ref(0);

// Filter Tanggal
const dates = ref([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Awal bulan ini
    new Date() // Hari ini
]);

// Menu Laporan (Sidebar)
const tabs = ref([
    { label: 'Laba Rugi (Profit & Loss)', icon: 'pi pi-chart-line' },
    { label: 'Neraca (Balance Sheet)', icon: 'pi pi-building' }
]);

// --- LOGIC PERHITUNGAN ---

// 1. Laba Rugi (Revenue & Expense)
const profitLossData = computed(() => {
    // Ambil data REVENUE (Pendapatan) dan EXPENSE (Beban)
    const revenue = rawData.value.filter((a: any) => a.category === 'REVENUE');
    const expense = rawData.value.filter((a: any) => a.category === 'EXPENSE');

    const totalRevenue = revenue.reduce((sum: any, item: any) => sum + (Number(item.balance) || 0), 0);
    const totalExpense = expense.reduce((sum: any, item: any) => sum + (Number(item.balance) || 0), 0);

    // Net Profit = Pendapatan - Beban
    const netProfit = totalRevenue - totalExpense;

    return { revenue, expense, totalRevenue, totalExpense, netProfit };
});

// 2. Neraca (Asset, Liability, Equity)
const balanceSheetData = computed(() => {
    const assets = rawData.value.filter((a: any) => a.category === 'ASSET');
    const liabilities = rawData.value.filter((a: any) => a.category === 'LIABILITY');
    const equity = rawData.value.filter((a: any) => a.category === 'EQUITY');

    const totalAsset = assets.reduce((sum: any, item: any) => sum + (Number(item.balance) || 0), 0);
    const totalLiability = liabilities.reduce((sum: any, item: any) => sum + (Number(item.balance) || 0), 0);
    
    // Equity Awal (Modal Disetor, dll)
    const totalEquityInitial = equity.reduce((sum: any, item: any) => sum + (Number(item.balance) || 0), 0);
    
    // Laba Berjalan (Retained Earnings) diambil dari perhitungan Laba Rugi
    // INI KUNCI AGAR SEIMBANG: Laba masuk ke Ekuitas
    const currentEarnings = profitLossData.value.netProfit;
    
    const totalEquityFinal = totalEquityInitial + currentEarnings;

    return { 
        assets, liabilities, equity, 
        totalAsset, totalLiability, totalEquityInitial, 
        currentEarnings, // Dikirim ke BalanceSheetTab agar bisa dirender sebagai baris akun
        totalEquityFinal 
    };
});

// --- FETCH DATA ---
const loadData = async () => {
    if (!dates.value || dates.value.length < 2) return;
    
    loading.value = true;
    try {
        const start = dates.value[0]!.toISOString();
        const end = dates.value[1]!.toISOString();
        
        // Panggil Backend
        const response = await accountService.getFinancialReport(start, end);
        rawData.value = Array.isArray(response) ? response : (response as any).data || [];
        
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan keuangan' });
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    loadData();
});
</script>

<template>
    <div class="p-4 md:p-6 min-h-screen flex flex-col h-full bg-surface-50 transition-colors duration-300">

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-surface-900 flex items-center gap-2 m-0">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                        <i class="pi pi-book text-xl"></i>
                    </div>
                    Laporan Keuangan
                </h1>
                <p class="text-sm text-surface-500 mt-2">Neraca Saldo dan Laba Rugi Periode Berjalan</p>
            </div>
            
            <div class="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-2xl border border-surface-200 shadow-sm w-full md:w-auto">
                <Calendar v-model="dates" selectionMode="range" :manualInput="false" showIcon placeholder="Pilih Periode" class="w-full sm:w-64" inputClass="!rounded-xl !py-2 !text-sm" />
                <Button icon="pi pi-search" label="Terapkan" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm w-full sm:w-auto" severity="primary" />
                <Button icon="pi pi-cog" label="" @click="router.push('/setting?tab=config_journal')"  :loading="loading" class="!rounded-xl shadow-sm" severity="secondary" />
            </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-6 flex-1 items-start">
            
            <div class="w-full lg:w-72 bg-white rounded-2xl shadow-sm border border-surface-200 p-3 shrink-0 lg:sticky lg:top-24">
                <div class="text-xs font-bold text-surface-500 uppercase tracking-widest mb-3 px-3 mt-2">Jenis Laporan</div>
                <div class="flex flex-col gap-1.5">
                    <button 
                        v-for="(tab, index) in tabs" 
                        :key="index"
                        @click="activeTab = index"
                        class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left outline-none"
                        :class="activeTab === index 
                            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100 font-bold' 
                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 border border-transparent'"
                    >
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0" 
                             :class="activeTab === index ? 'bg-blue-200/50 text-blue-700' : 'bg-surface-100 text-surface-500'">
                            <i :class="tab.icon" class="text-[15px]"></i>
                        </div>
                        <span class="flex-1">{{ tab.label }}</span>
                        <i v-if="activeTab === index" class="pi pi-chevron-right text-[10px] text-blue-500"></i>
                    </button>
                </div>
            </div>

            <div class="flex-1 w-full bg-white rounded-2xl shadow-sm border border-surface-200 min-h-[500px] overflow-hidden">
                <div v-if="loading" class="flex flex-col items-center justify-center h-96 text-surface-500">
                    <i class="pi pi-spin pi-spinner text-4xl mb-4 text-blue-500"></i>
                    <p class="text-sm font-medium">Menghitung data laporan...</p>
                </div>

                <div v-else class="animate-fade-in">
                    <ProfitLossTab 
                        v-if="activeTab === 0" 
                        :data="profitLossData" 
                    />
                    <BalanceSheetTab 
                        v-if="activeTab === 1" 
                        :data="balanceSheetData" 
                    />
                </div>
            </div>

        </div>

    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>