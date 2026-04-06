<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'primevue/chart';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const loading = ref(false);
const chartData = ref(null);
const chartOptions = ref(null);

// Rentang tanggal default: 7 hari terakhir
const dateRange = ref([
    new Date(new Date().setDate(new Date().getDate() - 7)),
    new Date()
]);

const loadGraphData = async () => {
    if (!dateRange.value || !dateRange.value[1]) return;
    
    loading.value = true;
    try {
        const start = dateRange.value[0].toISOString().split('T')[0];
        const end = dateRange.value[1].toISOString().split('T')[0];
        
        const response = await journalService.getChartData(start, end);
        const rawData = response?.data || response || [];

        // Persiapkan Label (Tanggal)
        const labels = rawData.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));

        chartData.value = {
            labels,
            datasets: [
                {
                    label: 'Penjualan',
                    data: rawData.map(d => d.sale),
                    borderColor: '#10b981', // Emerald
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Pembelian',
                    data: rawData.map(d => d.buy),
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Piutang (AR)',
                    data: rawData.map(d => d.ar),
                    borderColor: '#8b5cf6', // Violet
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Hutang (AP)',
                    data: rawData.map(d => d.ap),
                    borderColor: '#ef4444', // Red
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Retur Jual',
                    data: rawData.map(d => d.ret_sale),
                    borderColor: '#f59e0b', // Amber
                    backgroundColor: '#f59e0b',
                    type: 'bar' // Tampilkan retur sebagai bar agar beda
                }
            ]
        };

        setChartOptions();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data grafik' });
    } finally {
        loading.value = false;
    }
};

const setChartOptions = () => {
    chartOptions.value = {
        maintainAspectRatio: false,
        aspectRatio: 0.6,
        plugins: {
            legend: { labels: { color: '#4b5563', font: { weight: '600', size: 11 } } },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8', callback: (val) => 'Rp ' + val.toLocaleString() }, grid: { color: '#f1f5f9' } }
        }
    };
};

watch(dateRange, () => loadGraphData());
onMounted(() => loadGraphData());
</script>

<template>
    <div class="p-4 md:p-6 min-h-screen bg-surface-50">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-surface-900 flex items-center gap-2">
                    <i class="pi pi-chart-bar text-blue-600"></i> Analisis Grafik Transaksi
                </h1>
                <p class="text-sm text-surface-500">Visualisasi performa penjualan, pengadaan, dan arus hutang piutang.</p>
            </div>
            
            <div class="flex items-center gap-3 bg-white p-2 rounded-xl border border-surface-200 shadow-sm">
                <span class="text-xs font-bold text-surface-400 pl-2 uppercase">Periode:</span>
                <Calendar v-model="dateRange" selectionMode="range" :manualInput="false" showIcon dateFormat="dd/mm/yy" class="!border-0" inputClass="!py-1 !text-sm !font-bold" />
                <Button icon="pi pi-sync" @click="loadGraphData" :loading="loading" text rounded />
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6">
            <div class="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm relative min-h-[500px]">
                <div v-if="loading" class="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                    <ProgressSpinner style="width: 50px; height: 50px" />
                </div>
                
                <div class="flex justify-between items-center mb-6">
                    <span class="text-sm font-bold text-surface-700 uppercase tracking-widest">Tren Transaksi & Saldo</span>
                    <div class="flex gap-2">
                        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> <span class="text-[10px] font-bold">SALE</span></div>
                        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-blue-500"></span> <span class="text-[10px] font-bold">BUY</span></div>
                        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-rose-500"></span> <span class="text-[10px] font-bold">AP</span></div>
                    </div>
                </div>

                <div class="h-[400px]">
                    <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div class="bg-white p-4 rounded-xl border border-emerald-100 flex flex-col items-center shadow-sm">
                    <div class="text-[10px] font-bold text-emerald-600 uppercase mb-1">Sale</div>
                    <div class="w-full h-1 bg-emerald-500 rounded-full"></div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-blue-100 flex flex-col items-center shadow-sm">
                    <div class="text-[10px] font-bold text-blue-600 uppercase mb-1">Buy</div>
                    <div class="w-full h-1 bg-blue-500 rounded-full"></div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-indigo-100 flex flex-col items-center shadow-sm">
                    <div class="text-[10px] font-bold text-indigo-600 uppercase mb-1">Receivable</div>
                    <div class="w-full h-1 bg-indigo-500 rounded-full border-dashed"></div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-rose-100 flex flex-col items-center shadow-sm">
                    <div class="text-[10px] font-bold text-rose-600 uppercase mb-1">Payable</div>
                    <div class="w-full h-1 bg-rose-500 rounded-full border-dashed"></div>
                </div>
                <div class="bg-white p-4 rounded-xl border border-amber-100 flex flex-col items-center shadow-sm">
                    <div class="text-[10px] font-bold text-amber-600 uppercase mb-1">Return</div>
                    <div class="w-full h-2 bg-amber-500 rounded-sm"></div>
                </div>
            </div>
        </div>
    </div>
</template>