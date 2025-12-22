<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import dayjs from 'dayjs'; 

// Anggap useJournalService sudah di-import di composable
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
    totalReturnSale: 0,   // [UPDATE] Retur Penjualan
    totalReturnBuy: 0,    // [BARU] Retur Pembelian
    profitAdjusted: 0 
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

        // ASUMSI: journalService.getChartData sekarang menyertakan total_rt_sale dan total_rt_buy
        const rawData = await journalService.getChartData(startStr, endStr);
        
        // 1. Mapping Data untuk Chart
        const labels = rawData.map(item => dayjs(item.date).format('DD MMM'));
        
        const dataSale = rawData.map(item => Number(item.total_sale || 0));
        const dataBuy = rawData.map(item => Number(item.total_buy || 0));
        
        const dataReturnSale = rawData.map(item => Number(item.total_rt_sale || 0)); 
        const dataReturnBuy = rawData.map(item => Number(item.total_rt_buy || 0)); // [BARU]
        
        // 2. Hitung Total untuk Summary Cards
        const totalSale = dataSale.reduce((a, b) => a + b, 0);
        const totalBuy = dataBuy.reduce((a, b) => a + b, 0);
        
        const totalReturnSale = dataReturnSale.reduce((a, b) => a + b, 0); 
        const totalReturnBuy = dataReturnBuy.reduce((a, b) => a + b, 0); // [BARU]
        
        summary.value = {
            totalSale,
            totalBuy,
            totalReturnSale, 
            totalReturnBuy, // [BARU]
            // Profit dihitung: Pemasukan - (Pengeluaran - RT_BUY) - RT_SALE
            // Equivalent: Pemasukan + RT_BUY - Pengeluaran - RT_SALE
            profitAdjusted: totalSale + totalReturnBuy - totalBuy - totalReturnSale 
        };

        // 3. Setup Dataset Chart
        chartData.value = {
            labels: labels,
            datasets: [
                // Dataset 1: Pemasukan
                {
                    label: 'Pemasukan (Omset Kotor)',
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
                // Dataset 2: Pengeluaran
                {
                    label: 'Pengeluaran (Belanja Kotor)',
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
                },
                // Dataset 3: Retur Penjualan (Pengurang Omset/Profit)
                {
                    label: 'Retur Penjualan',
                    data: dataReturnSale,
                    fill: false,
                    borderColor: '#ef4444', // Red (Negative)
                    backgroundColor: '#ef4444',
                    borderDash: [5, 5], 
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#ef4444',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                // [BARU] Dataset 4: Retur Pembelian (Pengurang Pengeluaran/Positif Profit)
                {
                    label: 'Retur Pembelian',
                    data: dataReturnBuy,
                    fill: false,
                    borderColor: '#3b82f6', // Blue (Positive effect)
                    backgroundColor: '#3b82f6',
                    borderDash: [5, 5], 
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        };
    } catch (e) {
        console.error("Gagal memuat data chart:", e);
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
                grid: { display: false }
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

// Watcher ini sudah benar dan akan memicu loadChartData saat dates berubah
watch(dates, () => {
    if (dates.value && dates.value[1]) {
        loadChartData();
    }
});

onMounted(() => {
    initDates();
    setChartOptions();
});

const refreshData = async () => {
    initDates();
    setChartOptions();
}

defineExpose({ refreshData });
</script>

<template>
    <div class="h-full flex flex-col pt-4">
        
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
            <div class="w-full lg:w-auto p-1.5 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col sm:flex-row gap-2 ml-auto">
                <div class="flex gap-1 bg-surface-100 dark:bg-surface-400 p-1 rounded-lg">
                    <button @click="applyQuickFilter(7)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors hover:bg-surface-0 hover:shadow-sm text-surface-600 dark:text-surface-300">7 Hari</button>
                    <button @click="applyQuickFilter(30)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors hover:bg-surface-0 hover:shadow-sm text-surface-600 dark:text-surface-300">30 Hari</button>
                    <button @click="applyQuickFilter('thisMonth')" class="px-3 py-1.5 text-xs font-bold rounded-md transition-colors hover:bg-surface-0 hover:shadow-sm text-surface-600 dark:text-surface-300">Bulan Ini</button>
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

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            
            <div class="p-5 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                            <i class="pi pi-arrow-up-right text-lg font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Pemasukan Kotor</span>
                    </div>
                    <div class="text-3xl font-black text-surface-800 dark:text-surface-100 tracking-tight">
                        {{ formatCurrency(summary.totalSale) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Total Omset Penjualan</div>
                </div>
                <i class="pi pi-wallet absolute -right-4 -bottom-6 text-[7rem] text-emerald-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>

            <div class="p-5 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                            <i class="pi pi-arrow-down-left text-lg font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Pengeluaran Kotor</span>
                    </div>
                    <div class="text-3xl font-black text-surface-800 dark:text-surface-100 tracking-tight">
                        {{ formatCurrency(summary.totalBuy) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Total Belanja Stok</div>
                </div>
                <i class="pi pi-shopping-bag absolute -right-4 -bottom-6 text-[7rem] text-orange-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>
            
            <div class="p-5 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400">
                            <i class="pi pi-undo text-lg font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Retur Jual (Kurang Omset)</span>
                    </div>
                    <div class="text-3xl font-black text-surface-800 dark:text-surface-100 tracking-tight">
                        {{ formatCurrency(summary.totalReturnSale) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Pengembalian dana ke customer</div>
                </div>
                <i class="pi pi-money-bill absolute -right-4 -bottom-6 text-[7rem] text-red-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>
            
            <div class="p-5 rounded-2xl shadow-lg border border-surface-200 dark:border-surface-800 relative overflow-hidden group">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                            <i class="pi pi-arrow-right-arrow-left text-lg font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-surface-500 uppercase tracking-wide">Retur Beli (Kurang Belanja)</span>
                    </div>
                    <div class="text-3xl font-black text-surface-800 dark:text-surface-100 tracking-tight">
                        {{ formatCurrency(summary.totalReturnBuy) }}
                    </div>
                    <div class="text-xs text-surface-400 mt-1">Uang kembali dari supplier</div>
                </div>
                <i class="pi pi-box absolute -right-4 -bottom-6 text-[7rem] text-blue-500 opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>

            <div class="col-span-full bg-gradient-to-br from-primary-600 to-indigo-700 p-5 rounded-2xl shadow-xl shadow-primary-500/30 relative overflow-hidden group text-white">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="p-2 bg-surface-0/20 backdrop-blur-sm rounded-xl text-white">
                            <i class="pi pi-chart-line text-lg font-bold"></i>
                        </div>
                        <span class="text-sm font-bold text-white/90 uppercase tracking-wide">Profit Bersih</span>
                    </div>
                    <div class="text-4xl font-black tracking-tight" :class="summary.profitAdjusted < 0 ? 'text-red-300' : 'text-white'">
                        {{ formatCurrency(summary.profitAdjusted) }}
                    </div>
                    <div class="text-xs text-white/70 mt-1">Omset - Belanja + Retur Beli - Retur Jual</div>
                </div>
                <i class="pi pi-dollar absolute -right-4 -bottom-6 text-[7rem] text-white opacity-10 group-hover:rotate-12 transition-transform"></i>
            </div>
        </div>

        <div class="p-6 rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 relative flex-1">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100">Tren Performa Periodik</h3>
                    <p class="text-xs text-surface-500">Grafik perbandingan arus kas masuk, keluar, dan retur</p>
                </div>
                <Button icon="pi pi-download" severity="secondary" text rounded v-tooltip.top="'Download Image'" />
            </div>

            <div v-if="loading" class="absolute inset-0 bg-surface-0/80 dark:bg-surface-400 z-20 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                <div class="flex flex-col items-center gap-3">
                    <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="4" />
                    <span class="text-xs font-bold text-surface-500">Memuat data analisis...</span>
                </div>
            </div>
            
            <div class="h-[400px] w-full">
                
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
            </div>
        </div>

    </div>
</template>