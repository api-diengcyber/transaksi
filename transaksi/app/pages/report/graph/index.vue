<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import dayjs from 'dayjs'; 
import { useToast } from 'primevue/usetoast';

// Asumsi useJournalService sudah di-import otomatis
const journalService = useJournalService();
const toast = useToast();

// State
const dates = ref([]); 
const loading = ref(false);
const chartData = ref(null);
const chartOptions = ref(null);

// State untuk Summary Cards
const summary = ref({
    totalSale: 0,
    totalBuy: 0,
    totalReturnSale: 0,
    totalReturnBuy: 0,
    profitAdjusted: 0 
});

// --- LOGIC TANGGAL & FILTER ---
const initDates = () => {
    applyQuickFilter(30); // Default 30 hari terakhir
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
};

// --- FETCH DATA ---
const loadChartData = async () => {
    if (!dates.value || dates.value.length < 2 || !dates.value[0] || !dates.value[1]) return;

    loading.value = true;
    try {
        const startStr = dayjs(dates.value[0]).format('YYYY-MM-DD');
        const endStr = dayjs(dates.value[1]).format('YYYY-MM-DD');

        // Panggil API Chart Data
        const rawData = await journalService.getChartData(startStr, endStr);
        
        // 1. Mapping Data untuk Chart
        const labels = rawData.map(item => dayjs(item.date).format('DD MMM'));
        
        const dataSale = rawData.map(item => Number(item.total_sale || 0));
        const dataBuy = rawData.map(item => Number(item.total_buy || 0));
        const dataReturnSale = rawData.map(item => Number(item.total_rt_sale || 0)); 
        const dataReturnBuy = rawData.map(item => Number(item.total_rt_buy || 0)); 
        
        // 2. Hitung Total untuk Summary Cards
        const totalSale = dataSale.reduce((a, b) => a + b, 0);
        const totalBuy = dataBuy.reduce((a, b) => a + b, 0);
        const totalReturnSale = dataReturnSale.reduce((a, b) => a + b, 0); 
        const totalReturnBuy = dataReturnBuy.reduce((a, b) => a + b, 0); 
        
        summary.value = {
            totalSale,
            totalBuy,
            totalReturnSale, 
            totalReturnBuy,
            // Profit = (Pemasukan + Uang Kembali dari Retur Beli) - (Pengeluaran + Uang Keluar untuk Retur Jual)
            profitAdjusted: (totalSale + totalReturnBuy) - (totalBuy + totalReturnSale) 
        };

        // 3. Setup Dataset Chart
        chartData.value = {
            labels: labels,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: dataSale,
                    fill: true,
                    borderColor: '#10b981', // Emerald
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                        return gradient;
                    },
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6
                },
                {
                    label: 'Pengeluaran',
                    data: dataBuy,
                    fill: true,
                    borderColor: '#f97316', // Orange
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.2)');
                        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
                        return gradient;
                    },
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f97316',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6
                },
                {
                    label: 'Retur Jual',
                    data: dataReturnSale,
                    fill: false,
                    borderColor: '#ef4444', // Red
                    backgroundColor: '#ef4444',
                    borderDash: [5, 5], 
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'Retur Beli',
                    data: dataReturnBuy,
                    fill: false,
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: '#3b82f6',
                    borderDash: [5, 5], 
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }
            ]
        };
    } catch (e) {
        console.error("Gagal memuat chart:", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data grafik.' });
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
                labels: { color: textColor, usePointStyle: true, font: { weight: '600' } },
                position: 'top',
                align: 'end'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1f2937',
                bodyColor: '#4b5563',
                borderColor: '#e5e7eb',
                borderWidth: 1,
                padding: 12,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 },
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

// Watcher untuk perubahan tanggal
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
    <div class="flex flex-col h-full bg-surface-50 transition-colors duration-300">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 class="text-2xl md:text-3xl font-bold  tracking-tight">Analisa POS</h1>
                <p class="text-surface-500  mt-1 text-sm">Grafik performa pos.</p>
            </div>

            <div class="w-full md:w-auto p-1.5 rounded-xl bg-surface-0 border border-surface-200  shadow-sm flex flex-col sm:flex-row gap-2">
                <div class="flex gap-1 bg-surface-100 p-1 rounded-lg">
                    <button @click="applyQuickFilter(7)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-all hover:bg-surface-0  hover:shadow-sm ">7 Hari</button>
                    <button @click="applyQuickFilter(30)" class="px-3 py-1.5 text-xs font-bold rounded-md transition-all hover:bg-surface-0  hover:shadow-sm ">30 Hari</button>
                    <button @click="applyQuickFilter('thisMonth')" class="px-3 py-1.5 text-xs font-bold rounded-md transition-all hover:bg-surface-0  hover:shadow-sm ">Bulan Ini</button>
                </div>

                <div class="flex gap-2 w-full sm:w-auto">
                    <Calendar 
                        v-model="dates" 
                        selectionMode="range" 
                        :manualInput="false" 
                        placeholder="Pilih Periode"
                        dateFormat="dd M yy"
                        showIcon
                        class="w-full sm:w-48"
                        inputClass="!text-xs !py-2 !border-none !shadow-none !bg-transparent"
                    />
                    <Button icon="pi pi-refresh" text rounded severity="secondary" @click="loadChartData" :loading="loading" />
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            
            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-arrow-up-right text-emerald-500 text-sm"></i>
                        <span class="text-xs font-bold text-surface-500 uppercase tracking-wide">Pemasukan</span>
                    </div>
                    <div class="text-xl font-black  tracking-tight truncate">
                        {{ formatCurrency(summary.totalSale) }}
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i class="pi pi-wallet text-6xl text-emerald-500"></i>
                </div>
            </div>

            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-arrow-down-left text-orange-500 text-sm"></i>
                        <span class="text-xs font-bold text-surface-500 uppercase tracking-wide">Pengeluaran</span>
                    </div>
                    <div class="text-xl font-black  tracking-tight truncate">
                        {{ formatCurrency(summary.totalBuy) }}
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i class="pi pi-shopping-bag text-6xl text-orange-500"></i>
                </div>
            </div>
            
            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-minus-circle text-red-500 text-sm"></i>
                        <span class="text-xs font-bold text-surface-500 uppercase tracking-wide">Retur Jual</span>
                    </div>
                    <div class="text-xl font-black text-red-600  tracking-tight truncate">
                        - {{ formatCurrency(summary.totalReturnSale) }}
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i class="pi pi-undo text-6xl text-red-500"></i>
                </div>
            </div>
            
            <div class="p-5 rounded-2xl bg-surface-0 shadow-sm border border-surface-200  relative overflow-hidden group hover:shadow-md transition-all">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-plus-circle text-blue-500 text-sm"></i>
                        <span class="text-xs font-bold text-surface-500 uppercase tracking-wide">Retur Beli</span>
                    </div>
                    <div class="text-xl font-black text-blue-600  tracking-tight truncate">
                        + {{ formatCurrency(summary.totalReturnBuy) }}
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i class="pi pi-replay text-6xl text-blue-500"></i>
                </div>
            </div>

            <div class="p-5 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 shadow-lg shadow-primary-500/30 relative overflow-hidden group text-white hover:scale-[1.02] transition-transform">
                <div class="relative z-10">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="pi pi-chart-line text-white text-sm"></i>
                        <span class="text-xs font-bold text-white/90 uppercase tracking-wide">Profit Bersih</span>
                    </div>
                    <div class="text-2xl font-black tracking-tight truncate">
                        {{ formatCurrency(summary.profitAdjusted) }}
                    </div>
                </div>
                <div class="absolute bottom-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity group-hover:rotate-12 transform origin-bottom-right">
                    <i class="pi pi-dollar text-7xl text-white"></i>
                </div>
            </div>
        </div>

        <div class="bg-surface-0 rounded-2xl shadow-sm border border-surface-200  relative flex-1 p-6 flex flex-col">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="font-bold text-lg ">Tren Arus Kas</h3>
                    <p class="text-xs text-surface-500">Pergerakan omset vs pengeluaran harian</p>
                </div>
                </div>

            <div v-if="loading" class="absolute inset-0 bg-surface-0/80 /80 z-20 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                <div class="flex flex-col items-center gap-3">
                    <i class="pi pi-spin pi-spinner text-3xl text-primary-500"></i>
                    <span class="text-xs font-bold text-surface-500">Memproses Data...</span>
                </div>
            </div>
            
            <div class="flex-1 w-full min-h-[300px]">
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full w-full" />
            </div>
        </div>

    </div>
</template>