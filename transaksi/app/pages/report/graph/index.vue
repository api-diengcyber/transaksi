<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import Chart from 'primevue/chart';
import { useToast } from 'primevue/usetoast';

// Asumsi auto-import untuk useJournalService dan komponen PrimeVue (Nuxt)
const journalService = useJournalService();
const toast = useToast();

const loading = ref(false);
const chartData = ref(null);
const chartOptions = ref(null);

// State untuk menyimpan total akumulasi data
const totals = ref({
    sale: 0,
    buy: 0,
    ar: 0,
    ap: 0,
    ret_sale: 0
});

// Rentang tanggal default: 7 hari terakhir
const dateRange = ref([
    new Date(new Date().setDate(new Date().getDate() - 7)),
    new Date()
]);

// Fungsi utilitas untuk format Rupiah
const formatRupiah = (value) => {
    if (!value) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

const loadGraphData = async () => {
    // Cegah fetch jika range tanggal belum lengkap dipilih
    if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1]) return;
    
    loading.value = true;
    try {
        const start = dateRange.value[0].toISOString().split('T')[0];
        const end = dateRange.value[1].toISOString().split('T')[0];
        
        const response = await journalService.getChartData(start, end);
        const rawData = response?.data || response || [];

        // Reset & Kalkulasi Total Akumulasi
        totals.value = { sale: 0, buy: 0, ar: 0, ap: 0, ret_sale: 0 };
        rawData.forEach(d => {
            totals.value.sale += Number(d.sale || 0);
            totals.value.buy += Number(d.buy || 0);
            totals.value.ar += Number(d.ar || 0);
            totals.value.ap += Number(d.ap || 0);
            totals.value.ret_sale += Number(d.ret_sale || 0);
        });

        // Persiapkan Label (Tanggal)
        const labels = rawData.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));

        chartData.value = {
            labels,
            datasets: [
                {
                    label: 'Penjualan',
                    data: rawData.map(d => d.sale || 0),
                    borderColor: '#10b981', // Emerald
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Pembelian',
                    data: rawData.map(d => d.buy || 0),
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Piutang (AR)',
                    data: rawData.map(d => d.ar || 0),
                    borderColor: '#8b5cf6', // Violet
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Hutang (AP)',
                    data: rawData.map(d => d.ap || 0),
                    borderColor: '#ef4444', // Red
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Retur Jual',
                    data: rawData.map(d => d.ret_sale || 0),
                    borderColor: '#f59e0b', // Amber
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    type: 'bar',
                    borderRadius: 4
                }
            ]
        };

        setChartOptions();
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Terjadi Kesalahan', detail: 'Gagal memuat data grafik dari server.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const setChartOptions = () => {
    chartOptions.value = {
        maintainAspectRatio: false,
        aspectRatio: 0.6,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { 
                position: 'bottom',
                labels: { 
                    color: '#475569', 
                    font: { family: 'inherit', weight: '600', size: 12 },
                    usePointStyle: true,
                    padding: 20
                } 
            },
            tooltip: { 
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 13, family: 'inherit' },
                bodyFont: { size: 13, family: 'inherit' },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatRupiah(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: { 
                ticks: { color: '#64748b', font: { family: 'inherit' } }, 
                grid: { display: false } 
            },
            y: { 
                beginAtZero: true,
                ticks: { 
                    color: '#64748b', 
                    font: { family: 'inherit' },
                    callback: (val) => {
                        if (val >= 1000000) return 'Rp ' + (val / 1000000).toFixed(1) + ' Jt';
                        if (val >= 1000) return 'Rp ' + (val / 1000).toFixed(0) + ' Rb';
                        return 'Rp ' + val;
                    }
                }, 
                border: { display: false },
                grid: { color: '#f1f5f9', drawBorder: false } 
            }
        }
    };
};

// Pastikan tanggal lengkap (start dan end) sebelum memuat ulang data
watch(dateRange, (newVal) => {
    if (newVal && newVal[0] && newVal[1]) {
        loadGraphData();
    }
});

onMounted(() => {
    loadGraphData();
});
</script>

<template>
    <div class="p-4 md:p-6 min-h-screen bg-slate-50 font-sans">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <div class="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <i class="pi pi-chart-line text-xl"></i>
                    </div>
                    Analisis Transaksi
                </h1>
                <p class="text-sm text-slate-500 mt-1 ml-12">Visualisasi performa penjualan, pembelian, dan arus hutang piutang.</p>
            </div>
            
            <div class="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <span class="text-xs font-bold text-slate-400 pl-3 uppercase tracking-wide">Periode</span>
                <Calendar 
                    v-model="dateRange" 
                    selectionMode="range" 
                    :manualInput="false" 
                    showIcon 
                    dateFormat="dd/mm/yy" 
                    class="border-none bg-transparent" 
                    inputClass="py-2 text-sm font-semibold text-slate-700 bg-transparent focus:ring-0 border-none cursor-pointer w-[200px]" 
                    placeholder="Pilih rentang tanggal"
                />
                <Button icon="pi pi-sync" @click="loadGraphData" :loading="loading" severity="secondary" text rounded aria-label="Refresh" />
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6">
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative min-h-[450px] flex flex-col">
                <div v-if="loading" class="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-2xl transition-all duration-300">
                    <ProgressSpinner strokeWidth="4" animationDuration=".5s" style="width: 40px; height: 40px" />
                    <span class="mt-3 text-sm font-semibold text-slate-500 animate-pulse">Memuat Data...</span>
                </div>
                
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-base font-bold text-slate-800">Tren Transaksi & Saldo</h2>
                </div>

                <div class="flex-grow h-[350px]">
                    <Chart type="line" :data="chartData" :options="chartOptions" class="h-full w-full" />
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div class="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors shadow-sm relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Total Penjualan</div>
                    <div class="text-lg font-black text-emerald-600 truncate" :title="formatRupiah(totals.sale)">{{ formatRupiah(totals.sale) }}</div>
                    <div class="w-full h-1 bg-emerald-100 rounded-full mt-3 overflow-hidden">
                        <div class="h-full bg-emerald-500 rounded-full w-full"></div>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors shadow-sm relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Total Pembelian</div>
                    <div class="text-lg font-black text-blue-600 truncate" :title="formatRupiah(totals.buy)">{{ formatRupiah(totals.buy) }}</div>
                    <div class="w-full h-1 bg-blue-100 rounded-full mt-3 overflow-hidden">
                        <div class="h-full bg-blue-500 rounded-full w-full"></div>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 hover:border-violet-300 transition-colors shadow-sm relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-16 h-16 bg-violet-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Piutang (AR)</div>
                    <div class="text-lg font-black text-violet-600 truncate" :title="formatRupiah(totals.ar)">{{ formatRupiah(totals.ar) }}</div>
                    <div class="w-full h-1 border-b-2 border-dashed border-violet-400 mt-3"></div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 hover:border-rose-300 transition-colors shadow-sm relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-16 h-16 bg-rose-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Hutang (AP)</div>
                    <div class="text-lg font-black text-rose-600 truncate" :title="formatRupiah(totals.ap)">{{ formatRupiah(totals.ap) }}</div>
                    <div class="w-full h-1 border-b-2 border-dashed border-rose-400 mt-3"></div>
                </div>

                <div class="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors shadow-sm relative overflow-hidden group">
                    <div class="absolute right-0 top-0 w-16 h-16 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Retur Penjualan</div>
                    <div class="text-lg font-black text-amber-500 truncate" :title="formatRupiah(totals.ret_sale)">{{ formatRupiah(totals.ret_sale) }}</div>
                    <div class="flex gap-1 mt-3">
                        <div class="w-full h-1 bg-amber-400 rounded-sm"></div>
                        <div class="w-1/3 h-1 bg-amber-400 rounded-sm"></div>
                        <div class="w-1/4 h-1 bg-amber-400 rounded-sm"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Memastikan font bawaan aplikasi / tailwind teraplikasikan di chart */
:deep(.p-chart) {
    font-family: inherit;
}
</style>