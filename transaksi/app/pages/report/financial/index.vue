<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

import ProfitLossTab from '~/components/financial/ProfitLossTab.vue';
// Pastikan path import ini sesuai dengan lokasi file BalanceSheetTab di atas
import BalanceSheetTab from '~/components/financial/BalanceSheetTab.vue';

const accountService = useAccountService(); 
const toast = useToast();

const loading = ref(false);
const rawData = ref<any[]>([]);
const activeTab = ref(0); // 0: Laba Rugi, 1: Neraca

// Filter Tanggal
const dates = ref([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Awal bulan ini
    new Date() // Hari ini
]);

const tabs = ref([
    { label: 'Laba Rugi (Profit & Loss)', icon: 'pi pi-chart-line' },
    { label: 'Neraca (Balance Sheet)', icon: 'pi pi-building' }
]);

// --- LOGIC PERHITUNGAN ---

// 1. Laba Rugi (Revenue & Expense)
const profitLossData = computed(() => {
    // Ambil data REVENUE (Pendapatan) dan EXPENSE (Beban)
    const revenue = rawData.value.filter(a => a.category === 'REVENUE');
    const expense = rawData.value.filter(a => a.category === 'EXPENSE');

    const totalRevenue = revenue.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
    const totalExpense = expense.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
    
    // Net Profit = Pendapatan - Beban
    const netProfit = totalRevenue - totalExpense;

    return { revenue, expense, totalRevenue, totalExpense, netProfit };
});

// 2. Neraca (Asset, Liability, Equity)
const balanceSheetData = computed(() => {
    const assets = rawData.value.filter(a => a.category === 'ASSET');
    const liabilities = rawData.value.filter(a => a.category === 'LIABILITY');
    const equity = rawData.value.filter(a => a.category === 'EQUITY');

    const totalAsset = assets.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
    const totalLiability = liabilities.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
    
    // Equity Awal (Modal Disetor, dll)
    const totalEquityInitial = equity.reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
    
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
        const start = dates.value[0].toISOString();
        const end = dates.value[1].toISOString();
        
        // Panggil Backend (yang sudah difix sebelumnya)
        const response = await accountService.getFinancialReport(start, end);
        rawData.value = Array.isArray(response) ? response : response.data || [];
        
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
    <div class="flex flex-col h-full bg-surface-50 dark:bg-surface-100 transition-colors duration-300">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 class="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-0 tracking-tight">Laporan Keuangan</h1>
                <p class="text-surface-500 dark:text-surface-400 mt-1 text-sm">Neraca Saldo dan Laba Rugi Periode Berjalan</p>
            </div>
            <div class="flex gap-2">
                <Calendar v-model="dates" selectionMode="range" :manualInput="false" showIcon placeholder="Pilih Periode" class="w-full md:w-64" />
                <Button icon="pi pi-search" label="Filter" @click="loadData" :loading="loading" />
            </div>
        </div>

        <div class="mb-6">
             <TabMenu :model="tabs" v-model:activeIndex="activeTab" class="w-full" />
        </div>

        <div class="flex-1 overflow-auto">
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
</template>