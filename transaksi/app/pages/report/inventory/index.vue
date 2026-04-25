<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import Chart from 'primevue/chart';
import { useToast } from 'primevue/usetoast';

// Asumsi auto-import untuk service
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

// Fungsi utilitas format angka
const formatNumber = (val) => {
    return new Intl.NumberFormat('id-ID').format(val || 0);
};

// --- Computed untuk Total (Lebih bersih daripada menghitung langsung di template) ---
const totalStockIn = computed(() => {
    return inventory.value.reduce((sum, item) => sum + item.stockIn, 0);
});

const totalStockOut = computed(() => {
    return inventory.value.reduce((sum, item) => sum + item.stockOut, 0);
});

const lowStockCount = computed(() => {
    return inventory.value.filter(item => item.finalStock <= 5).length;
});

const loadData = async () => {
    if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) return;
    loading.value = true;
    
    try {
        const start = dateRange.value[0].toISOString().split('T')[0];
        const end = dateRange.value[1].toISOString().split('T')[0];
        
        // Panggil API
        const response = await journalService.getInventoryReport(start, end);
        const chartRes = await journalService.getInventoryChart(start, end);

        // Ambil data (Bisa disesuaikan dengan struktur response Axios/Fetch Anda)
        const rawData = response?.data?.data || response?.data || response || [];
        
        // --- PROTEKSI DOUBLE/TWICE DATA ---
        // 1. Membersihkan data ganda dari API menggunakan Map (berdasarkan ID/UUID/Nama)
        // 2. Memastikan semua field angka dikonversi dengan Number()
        const cleanDataMap = new Map();
        
        rawData.forEach(item => {
            const uniqueKey = item.uuid || item.id || item.productCode || item.name; // Pilih key paling unik
            
            if (!cleanDataMap.has(uniqueKey)) {
                cleanDataMap.set(uniqueKey, {
                    ...item,
                    stockIn: Number(item.stockIn || 0),
                    stockOut: Number(item.stockOut || 0),
                    finalStock: Number(item.finalStock || 0)
                });
            }
        });

        inventory.value = Array.from(cleanDataMap.values());
        
        // Update Chart
        const finalChartData = chartRes?.data?.data || chartRes?.data || chartRes || [];
        prepareChart(finalChartData);

    } catch (e) {
        console.error("Error Load Data:", e);
        toast.add({ severity: 'error', summary: 'Gagal Memuat', detail: 'Terjadi kesalahan saat menarik data inventori.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const prepareChart = (rawData) => {
    // Pastikan rawData adalah array
    if (!Array.isArray(rawData)) return;

    const labels = rawData.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
    
    chartData.value = {
        labels,
        datasets: [
            {
                label: 'Barang Masuk (+)',
                data: rawData.map(d => Number(d.masuk || d.stockIn || 0)),
                fill: true,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderColor: '#10b981', // Emerald
                borderWidth: 2,
                tension: 0.4
            },
            {
                label: 'Barang Keluar (-)',
                data: rawData.map(d => Number(d.keluar || d.stockOut || 0)),
                fill: true,
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                borderColor: '#f43f5e', // Rose
                borderWidth: 2,
                tension: 0.4
            }
        ]
    };

    chartOptions.value = {
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: { 
            legend: { 
                position: 'bottom',
                labels: { color: '#64748b', font: { weight: '600', family: 'inherit' }, usePointStyle: true } 
            } 
        },
        scales: {
            y: { 
                beginAtZero: true, 
                ticks: { color: '#64748b', font: { family: 'inherit' } },
                border: { display: false },
                grid: { color: '#f1f5f9' }
            },
            x: { 
                ticks: { color: '#64748b', font: { family: 'inherit' } },
                grid: { display: false } 
            }
        }
    };
};

watch(dateRange, (newVal) => {
    if (newVal && newVal[0] && newVal[1]) {
        loadData();
    }
});

onMounted(() => loadData());
</script>

<template>
    <div class="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <div class="bg-blue-100 text-blue-600 p-2 rounded-lg">
                        <i class="pi pi-box text-xl"></i>
                    </div>
                    Laporan Inventori & Mutasi
                </h1>
                <p class="text-sm text-slate-500 mt-1 ml-12">Pantau pergerakan stok barang masuk dan keluar.</p>
            </div>
            
            <div class="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <span class="text-xs font-bold text-slate-400 pl-3 uppercase tracking-wide">Periode</span>
                <Calendar 
                    v-model="dateRange" 
                    selectionMode="range" 
                    showIcon 
                    dateFormat="dd/mm/yy" 
                    class="border-none" 
                    inputClass="py-2 text-sm font-semibold text-slate-700 focus:ring-0 border-none cursor-pointer w-[200px]"
                    placeholder="Pilih Tanggal"
                />
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative flex flex-col min-h-[350px]">
                <div v-if="loading" class="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl transition-all">
                    <ProgressSpinner strokeWidth="4" style="width: 40px; height: 40px" />
                </div>

                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-base font-bold text-slate-800">Tren Mutasi Harian</h2>
                </div>
                <div class="flex-grow h-[280px]">
                    <Chart type="line" :data="chartData" :options="chartOptions" class="h-full w-full" />
                </div>
            </div>

            <div class="flex flex-col gap-4">
                <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl text-white shadow-md relative overflow-hidden group">
                    <i class="pi pi-arrow-down-left absolute right-0 top-0 -mr-4 -mt-4 text-7xl opacity-20 transform group-hover:scale-110 transition-transform"></i>
                    <div class="text-xs font-bold opacity-90 uppercase tracking-wider">Total Barang Masuk</div>
                    <div class="text-4xl font-black mt-2">
                        {{ formatNumber(totalStockIn) }} <span class="text-sm font-medium opacity-80">Pcs</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-rose-500 to-rose-600 p-6 rounded-2xl text-white shadow-md relative overflow-hidden group">
                    <i class="pi pi-arrow-up-right absolute right-0 top-0 -mr-4 -mt-4 text-7xl opacity-20 transform group-hover:scale-110 transition-transform"></i>
                    <div class="text-xs font-bold opacity-90 uppercase tracking-wider">Total Barang Keluar</div>
                    <div class="text-4xl font-black mt-2">
                        {{ formatNumber(totalStockOut) }} <span class="text-sm font-medium opacity-80">Pcs</span>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                    <div>
                        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Stok Menipis (≤ 5)</div>
                        <div class="text-2xl font-black text-rose-600">
                            {{ formatNumber(lowStockCount) }} <span class="text-sm text-slate-500 font-medium">Produk</span>
                        </div>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                        <i class="pi pi-exclamation-triangle text-xl"></i>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4 border-b border-slate-100 bg-slate-50/50">
                <h2 class="text-sm font-bold text-slate-700">Rincian Pergerakan Stok</h2>
            </div>
            
            <DataTable 
                :value="inventory" 
                :loading="loading" 
                paginator 
                :rows="10" 
                stripedRows 
                responsiveLayout="scroll"
                class="p-datatable-sm text-sm"
            >
                <template #empty>
                    <div class="p-6 text-center text-slate-400">Tidak ada data inventori pada periode ini.</div>
                </template>

                <Column field="name" header="Nama Produk" sortable>
                    <template #body="{ data }">
                        <span class="font-semibold text-slate-800">{{ data.name || '-' }}</span>
                    </template>
                </Column>

                <Column field="stockIn" header="Masuk (+)" sortable>
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-emerald-600">{{ formatNumber(data.stockIn) }}</span>
                            <span v-if="data.stockIn > 0" class="text-[10px] text-emerald-500 bg-emerald-50 px-1.5 rounded"><i class="pi pi-arrow-down" style="font-size: 0.6rem"></i></span>
                        </div>
                    </template>
                </Column>

                <Column field="stockOut" header="Keluar (-)" sortable>
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-rose-600">{{ formatNumber(data.stockOut) }}</span>
                            <span v-if="data.stockOut > 0" class="text-[10px] text-rose-500 bg-rose-50 px-1.5 rounded"><i class="pi pi-arrow-up" style="font-size: 0.6rem"></i></span>
                        </div>
                    </template>
                </Column>

                <Column field="finalStock" header="Sisa Stok" sortable>
                    <template #body="{ data }">
                        <div class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border"
                            :class="data.finalStock <= 5 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : 'bg-slate-50 text-slate-700 border-slate-200'"
                        >
                            {{ formatNumber(data.finalStock) }} {{ data.unit || '' }}
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-datatable .p-datatable-thead > tr > th) {
    background-color: #f8fafc;
    color: #475569;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-top: 1rem;
    padding-bottom: 1rem;
}
:deep(.p-chart) {
    font-family: inherit;
}
</style>