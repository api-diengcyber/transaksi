<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import dayjs from 'dayjs'; 

const journalService = useJournalService();

// State
const dates = ref([]); 
const loading = ref(false);
const chartData = ref(null);
const chartOptions = ref(null);

// State untuk Summary Cards
const summary = ref({
    totalSale: 0,
    totalBuy: 0,
    profit: 0
});

// --- LOGIC TANGGAL & FILTER ---
const initDates = () => {
    applyQuickFilter(30); // Default 30 hari
};

const applyQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    
    if (days === 'thisMonth') {
        start.setDate(1); // Tanggal 1 bulan ini
    } else {
        start.setDate(start.getDate() - days);
    }
    dates.value = [start, end];
    // Watcher akan otomatis trigger loadChartData
};

// --- FETCH DATA ---
const loadChartData = async () => {
    if (!dates.value || dates.value.length < 2 || !dates.value[0] || !dates.value[1]) return;

    loading.value = true;
    try {
        const startStr = dayjs(dates.value[0]).format('YYYY-MM-DD');
        const endStr = dayjs(dates.value[1]).format('YYYY-MM-DD');

        const rawData = await journalService.getChartData(startStr, endStr);
        
        // 1. Mapping Data untuk Chart
        const labels = rawData.map(item => dayjs(item.date).format('DD MMM'));
        const dataSale = rawData.map(item => Number(item.total_sale));
        const dataBuy = rawData.map(item => Number(item.total_buy));

        // 2. Hitung Total untuk Summary Cards
        const totalSale = dataSale.reduce((a, b) => a + b, 0);
        const totalBuy = dataBuy.reduce((a, b) => a + b, 0);
        
        summary.value = {
            totalSale,
            totalBuy,
            profit: totalSale - totalBuy
        };

        // 3. Setup Dataset Chart
        chartData.value = {
            labels: labels,
            datasets: [
                {
                    label: 'Pemasukan (Omset)',
                    data: dataSale,
                    fill: true,
                    borderColor: '#10b981', // Emerald 500
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
                        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                        return gradient;
                    },
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Pengeluaran (Belanja)',
                    data: dataBuy,
                    fill: true,
                    borderColor: '#f97316', // Orange 500
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
                        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
                        return gradient;
                    },
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f97316',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        };
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

// --- CONFIG CHART ---
const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    chartOptions.value = {
        maintainAspectRatio: false,
        aspectRatio: 0.6,
        plugins: {
            legend: {
                labels: { color: textColor, usePointStyle: true, font: { weight: 'bold' } },
                position: 'top',
                align: 'end'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1f2937',
                bodyColor: '#4b5563',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits:0 }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: textColorSecondary },
                grid: { display: false } // Hilangkan grid vertikal biar bersih
            },
            y: {
                ticks: { 
                    color: textColorSecondary,
                    callback: (value) => {
                        return value >= 1000000 ? (value / 1000000) + ' Jt' : value >= 1000 ? (value / 1000) + ' rb' : value;
                    }
                },
                grid: { color: surfaceBorder, borderDash: [5, 5] }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
};

// --- UTILS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

watch(dates, () => {
    if (dates.value && dates.value[1]) {
        loadChartData();
    }
});

onMounted(() => {
    initDates();
    setChartOptions();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 md:p-6 animate-fade-in font-sans">
        
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
            <div>
                <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">
                    Analisis Keuangan
                </h1>
                <p class="text-surface-500 dark:text-surface-400 mt-1">
                    Visualisasi tren arus kas masuk dan keluar toko Anda.
                </p>
            </div>
            
            <div class="w-full lg:w-auto bg-white dark:bg-surface-900 p-1.5 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col sm:flex-row gap-2">
                <div class="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg">
                    <button @click="applyQuickFilter(7)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors hover:bg-white hover:shadow-sm text-surface-600">7 Hari</button>
                    <button @click="applyQuickFilter(30)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors bg-white shadow-sm text-primary-600">30 Hari</button>
                    <button @click="applyQuickFilter('thisMonth')" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors hover:bg-white hover:shadow-sm text-surface-600">Bulan Ini</button>
                </div>

                <Calendar 
                    v-model="dates" 
                    selectionMode="range" 
                    :manualInput="false" 
                    placeholder="Pilih Periode"
                    dateFormat="dd M yy"
                    showIcon
                    class="w-full sm:w-56"
                    inputClass="!text-sm !border-none !shadow-none"
                />
                <Button icon="pi pi-search" class="!rounded-lg" @click="loadChartData" :loading="loading" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            <div class="bg-white dark:bg-surface-900 p-5 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600">
                            <i class="pi pi-arrow-up-right text-sm font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Pemasukan</span>
                    </div>
                    <div class="text-2xl font-black text-surface-800 dark:text-surface-100">
                        {{ formatCurrency(summary.totalSale) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Total Omset Periode Ini</div>
                </div>
                <i class="pi pi-wallet absolute -right-2 -bottom-4 text-[5rem] text-emerald-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>

            <div class="bg-white dark:bg-surface-900 p-5 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600">
                            <i class="pi pi-arrow-down-left text-sm font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Pengeluaran</span>
                    </div>
                    <div class="text-2xl font-black text-surface-800 dark:text-surface-100">
                        {{ formatCurrency(summary.totalBuy) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Total Belanja Stok</div>
                </div>
                <i class="pi pi-shopping-bag absolute -right-2 -bottom-4 text-[5rem] text-orange-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>

            <div class="bg-gradient-to-br from-primary-600 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-primary-500/20 relative overflow-hidden group text-white">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white">
                            <i class="pi pi-chart-line text-sm font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-white/80 uppercase tracking-wide">Margin / Surplus</span>
                    </div>
                    <div class="text-3xl font-black tracking-tight">
                        {{ formatCurrency(summary.profit) }}
                    </div>
                    <div class="text-xs text-white/70 mt-1">Selisih Pemasukan & Pengeluaran</div>
                </div>
                <i class="pi pi-star absolute -right-2 -bottom-4 text-[6rem] text-white opacity-10 group-hover:rotate-12 transition-transform"></i>
            </div>
        </div>

        <div class="bg-white dark:bg-surface-900 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 relative">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100">Tren Performa</h3>
                    <p class="text-xs text-surface-500">Grafik perbandingan harian</p>
                </div>
                <Button icon="pi pi-download" severity="secondary" text rounded v-tooltip.top="'Download Image'" />
            </div>

            <div v-if="loading" class="absolute inset-0 bg-white/80 dark:bg-surface-900/80 z-20 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                <div class="flex flex-col items-center gap-3">
                    <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                    <span class="text-xs font-bold text-surface-500">Memuat data...</span>
                </div>
            </div>
            
            <div class="h-[400px] w-full">
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
            </div>
        </div>

    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.5s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>