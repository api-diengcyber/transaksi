<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const accountService = useAccountService(); //
const toast = useToast();

const loading = ref(false);
const rawData = ref([]);
const activeTab = ref(0); // 0: Laba Rugi, 1: Neraca

// Filter Tanggal
const dates = ref([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Awal bulan
    new Date() // Hari ini
]);

const tabs = [
    { label: 'Laba Rugi (Profit & Loss)', icon: 'pi pi-chart-line' },
    { label: 'Neraca (Balance Sheet)', icon: 'pi pi-building' }
];

// --- LOGIC PERHITUNGAN ---

// 1. Laba Rugi (Revenue & Expense)
const profitLossData = computed(() => {
    const revenue = rawData.value.filter(a => a.category === 'REVENUE'); //
    const expense = rawData.value.filter(a => a.category === 'EXPENSE'); //

    const totalRevenue = revenue.reduce((sum, item) => sum + item.balance, 0);
    const totalExpense = expense.reduce((sum, item) => sum + item.balance, 0);
    const netProfit = totalRevenue - totalExpense;

    return { revenue, expense, totalRevenue, totalExpense, netProfit };
});

// 2. Neraca (Asset, Liability, Equity)
const balanceSheetData = computed(() => {
    const assets = rawData.value.filter(a => a.category === 'ASSET');
    const liabilities = rawData.value.filter(a => a.category === 'LIABILITY');
    const equity = rawData.value.filter(a => a.category === 'EQUITY');

    const totalAsset = assets.reduce((sum, item) => sum + item.balance, 0);
    const totalLiability = liabilities.reduce((sum, item) => sum + item.balance, 0);
    
    // Equity Awal
    const totalEquityInitial = equity.reduce((sum, item) => sum + item.balance, 0);
    
    // Laba Berjalan (Retained Earnings) diambil dari perhitungan Laba Rugi
    const currentEarnings = profitLossData.value.netProfit;
    
    const totalEquityFinal = totalEquityInitial + currentEarnings;

    return { 
        assets, liabilities, equity, 
        totalAsset, totalLiability, totalEquityInitial, 
        currentEarnings, totalEquityFinal 
    };
});

// --- FETCH DATA ---
const loadData = async () => {
    if (!dates.value || dates.value.length < 2) return;
    
    loading.value = true;
    try {
        const start = dates.value[0].toISOString();
        const end = dates.value[1].toISOString();
        
        const response = await accountService.getFinancialReport(start, end);
        rawData.value = Array.isArray(response) ? response : response.data || [];
        
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan keuangan' });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
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

        <div v-if="activeTab === 0" class="flex flex-col gap-4 max-w-4xl mx-auto w-full">
            
            <div class="p-6 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 text-center relative overflow-hidden">
                <p class="text-sm font-bold text-surface-500 uppercase tracking-widest mb-2">Laba / Rugi Bersih</p>
                <h2 class="text-4xl font-black" :class="profitLossData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ formatCurrency(profitLossData.netProfit) }}
                </h2>
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
            </div>

            <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
                <div class="p-4 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                    <h3 class="font-bold text-surface-800 dark:text-surface-0">PENDAPATAN (REVENUE)</h3>
                    <span class="font-bold text-emerald-600">{{ formatCurrency(profitLossData.totalRevenue) }}</span>
                </div>
                <DataTable :value="profitLossData.revenue" size="small" stripedRows>
                    <Column field="code" header="Kode" style="width: 15%"></Column>
                    <Column field="name" header="Nama Akun"></Column>
                    <Column field="balance" header="Saldo" class="text-right">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.balance) }}
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
                <div class="p-4 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                    <h3 class="font-bold text-surface-800 dark:text-surface-0">BEBAN (EXPENSE)</h3>
                    <span class="font-bold text-rose-600">{{ formatCurrency(profitLossData.totalExpense) }}</span>
                </div>
                <DataTable :value="profitLossData.expense" size="small" stripedRows>
                    <Column field="code" header="Kode" style="width: 15%"></Column>
                    <Column field="name" header="Nama Akun"></Column>
                    <Column field="balance" header="Saldo" class="text-right">
                        <template #body="slotProps">
                            {{ formatCurrency(slotProps.data.balance) }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <div v-if="activeTab === 1" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div class="flex flex-col gap-4">
                <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden h-full">
                    <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex justify-between items-center">
                        <h3 class="font-bold text-blue-800 dark:text-blue-300">AKTIVA / HARTA</h3>
                        <span class="font-black text-lg text-blue-700 dark:text-blue-300">{{ formatCurrency(balanceSheetData.totalAsset) }}</span>
                    </div>
                    <DataTable :value="balanceSheetData.assets" size="small" stripedRows>
                         <Column field="code" header="Kode" style="width: 20%"></Column>
                         <Column field="name" header="Nama Akun"></Column>
                         <Column field="balance" header="Nilai" class="text-right">
                            <template #body="slotProps">
                                {{ formatCurrency(slotProps.data.balance) }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>

            <div class="flex flex-col gap-4">
                
                <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
                    <div class="p-4 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800 flex justify-between items-center">
                        <h3 class="font-bold text-orange-800 dark:text-orange-300">KEWAJIBAN / HUTANG</h3>
                        <span class="font-bold text-lg text-orange-700 dark:text-orange-300">{{ formatCurrency(balanceSheetData.totalLiability) }}</span>
                    </div>
                    <DataTable :value="balanceSheetData.liabilities" size="small" stripedRows>
                         <Column field="code" header="Kode" style="width: 20%"></Column>
                         <Column field="name" header="Nama Akun"></Column>
                         <Column field="balance" header="Nilai" class="text-right">
                            <template #body="slotProps">
                                {{ formatCurrency(slotProps.data.balance) }}
                            </template>
                        </Column>
                    </DataTable>
                </div>

                <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
                    <div class="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800 flex justify-between items-center">
                        <h3 class="font-bold text-purple-800 dark:text-purple-300">MODAL / EKUITAS</h3>
                        <span class="font-bold text-lg text-purple-700 dark:text-purple-300">{{ formatCurrency(balanceSheetData.totalEquityFinal) }}</span>
                    </div>
                    <DataTable :value="balanceSheetData.equity" size="small" stripedRows>
                         <Column field="code" header="Kode" style="width: 20%"></Column>
                         <Column field="name" header="Nama Akun"></Column>
                         <Column field="balance" header="Nilai" class="text-right">
                            <template #body="slotProps">
                                {{ formatCurrency(slotProps.data.balance) }}
                            </template>
                        </Column>
                    </DataTable>
                    
                    <div class="p-3 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 flex justify-between items-center text-sm">
                        <span class="pl-2 font-medium">Laba Tahun Berjalan (Net Profit)</span>
                        <span class="font-bold" :class="balanceSheetData.currentEarnings >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                            {{ formatCurrency(balanceSheetData.currentEarnings) }}
                        </span>
                    </div>
                </div>

                 <div class="p-4 rounded-xl bg-surface-200 dark:bg-surface-700 flex justify-between items-center">
                    <span class="font-bold text-surface-600 dark:text-surface-300 uppercase text-sm">Total Pasiva (Hutang + Modal)</span>
                    <span class="font-black text-xl text-surface-800 dark:text-surface-0">
                        {{ formatCurrency(balanceSheetData.totalLiability + balanceSheetData.totalEquityFinal) }}
                    </span>
                 </div>
            </div>
        </div>

    </div>
</template>