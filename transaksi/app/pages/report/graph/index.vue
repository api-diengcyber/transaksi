<script setup>
import { ref, onMounted, watch } from 'vue';
import dayjs from 'dayjs'; // Pastikan sudah install dayjs, atau pakai native Date

const journalService = useJournalService();

// State
const dates = ref([]); // Array [Start, End]
const loading = ref(false);
const chartData = ref(null);
const chartOptions = ref(null);

// Inisialisasi Tanggal (30 Hari Terakhir)
const initDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    dates.value = [start, end];
};

// Fetch Data API & Update Chart
const loadChartData = async () => {
    if (!dates.value || dates.value.length < 2 || !dates.value[0] || !dates.value[1]) return;

    loading.value = true;
    try {
        const startStr = dayjs(dates.value[0]).format('YYYY-MM-DD');
        const endStr = dayjs(dates.value[1]).format('YYYY-MM-DD');

        const rawData = await journalService.getChartData(startStr, endStr);
        
        // Mapping Data API ke ChartJS Format
        const labels = rawData.map(item => dayjs(item.date).format('DD MMM'));
        const dataSale = rawData.map(item => Number(item.total_sale));
        const dataBuy = rawData.map(item => Number(item.total_buy));

        chartData.value = {
            labels: labels,
            datasets: [
                {
                    label: 'Penjualan (Omset)',
                    data: dataSale,
                    fill: true,
                    borderColor: '#10b981', // Emerald 500
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    pointBackgroundColor: '#10b981'
                },
                {
                    label: 'Pembelian (Modal Keluar)',
                    data: dataBuy,
                    fill: true,
                    borderColor: '#f97316', // Orange 500
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    tension: 0.4,
                    pointBackgroundColor: '#f97316'
                }
            ]
        };
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

// Konfigurasi Tampilan Chart
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
                labels: { color: textColor }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: textColorSecondary },
                grid: { color: surfaceBorder }
            },
            y: {
                ticks: { 
                    color: textColorSecondary,
                    callback: (value) => {
                        return value >= 1000000 ? (value / 1000000) + 'Jt' : value >= 1000 ? (value / 1000) + 'rb' : value;
                    }
                },
                grid: { color: surfaceBorder }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
};

// Watcher jika tanggal berubah
watch(dates, () => {
    if (dates.value && dates.value[1]) {
        loadChartData();
    }
});

onMounted(() => {
    initDates();
    setChartOptions();
    loadChartData();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="card animate-fade-in p-4">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Grafik Analisis</h1>
                <p class="text-surface-500 mt-1">Perbandingan nilai penjualan vs pembelian.</p>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-2 bg-surface-0 dark:bg-surface-900 p-2 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm">
                <Calendar 
                    v-model="dates" 
                    selectionMode="range" 
                    :manualInput="false" 
                    placeholder="Pilih Periode"
                    dateFormat="dd M yy"
                    showIcon
                    class="w-full sm:w-64"
                    inputClass="!text-sm"
                />
                <Button icon="pi pi-search" label="Terapkan" @click="loadChartData" :loading="loading" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border-l-4 border-green-500 flex justify-between items-center">
                <div>
                    <span class="text-surface-500 text-sm font-bold uppercase">Total Penjualan (Periode Ini)</span>
                    <div class="text-2xl font-black text-surface-800 dark:text-surface-100 mt-1">
                        {{ 
                            chartData ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                                chartData.datasets[0].data.reduce((a, b) => a + b, 0)
                            ) : 'Rp 0'
                        }}
                    </div>
                </div>
                <div class="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                    <i class="pi pi-shopping-cart text-green-600 text-xl"></i>
                </div>
            </div>
            
            <div class="bg-white dark:bg-surface-900 p-4 rounded-xl shadow-sm border-l-4 border-orange-500 flex justify-between items-center">
                <div>
                    <span class="text-surface-500 text-sm font-bold uppercase">Total Pembelian (Periode Ini)</span>
                    <div class="text-2xl font-black text-surface-800 dark:text-surface-100 mt-1">
                        {{ 
                            chartData ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(
                                chartData.datasets[1].data.reduce((a, b) => a + b, 0)
                            ) : 'Rp 0'
                        }}
                    </div>
                </div>
                <div class="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
                    <i class="pi pi-truck text-orange-600 text-xl"></i>
                </div>
            </div>
        </div>

        <div class="card bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm relative">
            <div v-if="loading" class="absolute inset-0 bg-white/50 dark:bg-surface-900/50 z-10 flex items-center justify-center">
                <ProgressSpinner style="width: 50px; height: 50px" />
            </div>
            
            <h3 class="font-bold text-lg mb-4 text-surface-700 dark:text-surface-200">Tren Harian</h3>
            <div class="h-[400px]">
                <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
            </div>
        </div>

    </div>
</template>