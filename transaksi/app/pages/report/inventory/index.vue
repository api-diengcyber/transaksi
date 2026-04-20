<script setup>
import { ref, onMounted, watch } from 'vue';
import Chart from 'primevue/chart';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const inventory = ref([]);
const loading = ref(true);
const chartData = ref(null);
const chartOptions = ref(null);

const dateRange = ref([
    new Date(new Date().setDate(new Date().getDate() - 7)),
    new Date()
]);

const loadData = async () => {
    if (!dateRange.value || !dateRange.value[1]) return;
    loading.value = true;
    
    try {
        const start = dateRange.value[0].toISOString().split('T')[0];
        const end = dateRange.value[1].toISOString().split('T')[0];
        
        // Panggil API
        const response = await journalService.getInventoryReport(start, end);
        const chartRes = await journalService.getInventoryChart(start, end);

        // --- POINT KRUSIAL: Pengecekan Struktur Data ---
        // Jika menggunakan Axios, data asli ada di response.data
        // Jika di Controller kita bungkus lagi dengan { data: ... }, maka:
        const finalData = response?.data?.data || response?.data || response || [];
        
        console.log("Data Inventori yang diterima:", finalData); // Cek di console log

        // Pastikan hasil akhirnya adalah ARRAY
        inventory.value = Array.isArray(finalData) ? finalData : [];
        
        // Update Chart
        const finalChartData = chartRes?.data?.data || chartRes?.data || chartRes || [];
        prepareChart(finalChartData);

    } catch (e) {
        console.error("Error Load Data:", e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data stok' });
    } finally {
        loading.value = false;
    }
};

const prepareChart = (rawData) => {
    const labels = rawData.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
    chartData.value = {
        labels,
        datasets: [
            {
                label: 'Barang Masuk (+)',
                data: rawData.map(d => d.masuk),
                fill: false,
                borderColor: '#10b981', // Emerald
                tension: 0.4
            },
            {
                label: 'Barang Keluar (-)',
                data: rawData.map(d => d.keluar),
                fill: false,
                borderColor: '#ef4444', // Red
                tension: 0.4
            }
        ]
    };
    chartOptions.value = {
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#4b5563' } } },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 10 } },
            x: { grid: { display: false } }
        }
    };
};

onMounted(() => loadData());
</script>

<template>
    <div class="min-h-screen bg-surface-50 p-4 md:p-6 font-sans">

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-surface-900 flex items-center gap-2">
                    <i class="pi pi-box text-blue-600"></i> Laporan Inventori & Grafik
                </h1>
            </div>
            
            <div class="flex items-center gap-3 bg-white p-2 rounded-xl border border-surface-200 shadow-sm">
                <Calendar v-model="dateRange" selectionMode="range" showIcon @date-select="loadData" class="shadow-sm" />
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-2xl border border-surface-200 shadow-sm">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-xs font-bold text-surface-500 uppercase">Tren Mutasi Barang Harian</span>
                    <div class="flex gap-2">
                        <span class="text-[10px] text-emerald-600 font-bold">● MASUK</span>
                        <span class="text-[10px] text-rose-600 font-bold">● KELUAR</span>
                    </div>
                </div>
                <div class="h-64">
                    <Chart type="line" :data="chartData" :options="chartOptions" class="h-full" />
                </div>
            </div>

            <div class="space-y-4">
                <div class="bg-emerald-500 p-6 rounded-2xl text-white shadow-lg">
                    <div class="text-xs font-medium opacity-80 uppercase">Total Barang Masuk</div>
                    <div class="text-3xl font-black mt-1">{{ inventory.reduce((s, i) => s + i.stockIn, 0) }} <span class="text-sm font-normal">Pcs</span></div>
                </div>
                <div class="bg-rose-500 p-6 rounded-2xl text-white shadow-lg">
                    <div class="text-xs font-medium opacity-80 uppercase">Total Barang Keluar</div>
                    <div class="text-3xl font-black mt-1">{{ inventory.reduce((s, i) => s + i.stockOut, 0) }} <span class="text-sm font-normal">Pcs</span></div>
                </div>
                <div class="bg-white p-6 rounded-2xl border border-surface-200 shadow-sm">
                    <div class="text-xs font-bold text-surface-400 uppercase">Item Menipis</div>
                    <div class="text-2xl font-black text-rose-600 mt-1">{{ inventory.filter(i => i.finalStock <= 5).length }} <span class="text-sm text-surface-400 font-normal">Produk</span></div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
            <DataTable :value="inventory" :loading="loading" paginator :rows="10" stripedRows class="p-datatable-sm text-sm">
                <Column field="name" header="Produk" sortable />
                <Column field="stockIn" header="Masuk" class="text-emerald-600 font-bold" />
                <Column field="stockOut" header="Keluar" class="text-rose-600 font-bold" />
                <Column field="finalStock" header="Sisa Stok" sortable>
                    <template #body="{ data }">
                        <b :class="data.finalStock <= 5 ? 'text-rose-600' : 'text-surface-900'">{{ data.finalStock }} {{ data.unit }}</b>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>