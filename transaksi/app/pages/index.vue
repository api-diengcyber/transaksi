<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth.store';
import { useRouter } from 'vue-router';

// Setup Layout & Meta
definePageMeta({ layout: 'default' });

const router = useRouter();
const authStore = useAuthStore();

// --- STATE & DATA ---
const userName = computed(() => authStore.user?.username || 'Pengguna');
const storeName = computed(() => authStore.activeStore?.name || 'Toko Default');
const greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 18) return 'Selamat Siang';
    return 'Selamat Malam';
});

// Menu Aksi Cepat (Quick Access) - Dikategorikan
const quickMenu = [
    {
        title: 'Kasir & Transaksi',
        desc: 'Proses penjualan dan pembayaran',
        icon: 'pi pi-shopping-cart',
        color: 'from-emerald-500 to-teal-600',
        route: '/transaction'
    },
    {
        title: 'Stok Masuk',
        desc: 'Input pembelian barang baru',
        icon: 'pi pi-download',
        color: 'from-blue-500 to-indigo-600',
        route: '/transaction?tab=buy'
    },
    {
        title: 'Manajemen Produk',
        desc: 'Tambah atau edit master barang',
        icon: 'pi pi-box',
        color: 'from-violet-500 to-purple-600',
        route: '/product'
    },
    {
        title: 'Laporan Keuangan',
        desc: 'Cek omset dan laba rugi',
        icon: 'pi pi-chart-line',
        color: 'from-orange-500 to-amber-600',
        route: '/report/graph'
    }
];

// Menu Sekunder (Grid Kecil)
const secondaryMenu = [
    { label: 'Retur Barang', icon: 'pi pi-refresh', route: '/transaction?tab=return', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
    { label: 'Hutang Piutang', icon: 'pi pi-book', route: '/arap', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' },
    { label: 'Stok Opname', icon: 'pi pi-check-square', route: '/inventory', color: 'text-lime-500 bg-lime-50 dark:bg-lime-900/20' },
    { label: 'Produksi', icon: 'pi pi-cog', route: '/production', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
    { label: 'Pelanggan', icon: 'pi pi-users', route: '/member', color: 'text-pink-500 bg-pink-50 dark:bg-pink-900/20' },
    { label: 'Pengaturan', icon: 'pi pi-cog', route: '/setting', color: 'text-gray-500 bg-gray-100 dark:bg-gray-800' },
];

// Mock Data untuk Aktivitas Terbaru (Timeline)
const recentActivities = ref([
    { title: 'Penjualan #INV-001', time: 'Baru saja', amount: '+ Rp 150.000', type: 'in' },
    { title: 'Pembelian Stok Beras', time: '15 menit lalu', amount: '- Rp 2.500.000', type: 'out' },
    { title: 'Retur Barang Rusak', time: '1 jam lalu', amount: 'Rp 0', type: 'neutral' },
    { title: 'Penjualan #INV-002', time: '2 jam lalu', amount: '+ Rp 75.000', type: 'in' },
]);

const navigateTo = (path) => router.push(path);
</script>

<template>
    <div class="animate-fade-in min-h-full flex flex-col gap-8">
        
        <div class="relative bg-gradient-to-r from-primary-900 to-primary-700 dark:from-surface-800 dark:to-surface-900 rounded-3xl p-8 lg:p-10 shadow-2xl overflow-hidden text-white">
            <div class="absolute top-0 right-0 w-64 h-64 bg-surface-0 opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div class="absolute bottom-0 left-0 w-48 h-48 bg-primary-400 opacity-10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-0 backdrop-blur-md border border-white/10 text-xs font-medium mb-3 text-primary-100">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        {{ storeName }} Active
                    </div>
                    <h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                        {{ greeting }}, <span class="text-primary-200">{{ userName }}</span>!
                    </h1>
                    <p class="text-primary-100/80 text-sm md:text-base max-w-lg leading-relaxed">
                        Siap untuk mengelola toko hari ini? Berikut ringkasan performa dan menu cepat untuk Anda.
                    </p>
                </div>
                <div class="hidden md:block text-right">
                    <div class="text-4xl font-black mb-1">Rp 12.500.000</div>
                    <div class="text-sm text-primary-200 font-medium">Omset Hari Ini <i class="pi pi-arrow-up text-emerald-400 ml-1"></i></div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-2 space-y-8">
                
                <div>
                    <h3 class="text-lg font-bold text-surface-700 dark:text-surface-100 mb-4 flex items-center gap-2">
                        <i class="pi pi-bolt text-amber-500"></i> Aksi Cepat
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div v-for="item in quickMenu" :key="item.title" 
                             @click="navigateTo(item.route)"
                             class="group relative overflow-hidden bg-surface-0 dark:bg-surface-800 p-5 rounded-2xl border border-surface-100 dark:border-surface-700 shadow-sm hover:shadow-lg transition-all cursor-pointer">
                            
                            <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-bl-full transition-transform group-hover:scale-110" :class="item.color"></div>
                            
                            <div class="relative z-10 flex items-start gap-4">
                                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br" :class="item.color">
                                    <i :class="[item.icon, 'text-xl']"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-surface-800 dark:text-surface-100 text-lg group-hover:text-primary-600 transition-colors">{{ item.title }}</h4>
                                    <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{{ item.desc }}</p>
                                </div>
                            </div>
                            <div class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                <i class="pi pi-arrow-right text-surface-400 text-sm"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="text-lg font-bold text-surface-700 dark:text-surface-100 mb-4 flex items-center gap-2">
                        <i class="pi pi-th-large text-primary-500"></i> Menu Lainnya
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                        <div v-for="item in secondaryMenu" :key="item.label"
                             @click="navigateTo(item.route)"
                             class="flex flex-col items-center justify-center gap-2 p-4 bg-surface-0 dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md cursor-pointer transition-all group">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" :class="item.color">
                                <i :class="[item.icon, 'text-lg']"></i>
                            </div>
                            <span class="text-xs font-semibold text-surface-600 dark:text-surface-300 text-center">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

            </div>

            <div class="space-y-6">
                
                <div class="bg-surface-0 dark:bg-surface-800 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-700 p-5">
                    <h3 class="font-bold text-surface-700 dark:text-surface-100 mb-4 text-sm uppercase tracking-wider">Ringkasan Hari Ini</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                                    <i class="pi pi-receipt"></i>
                                </div>
                                <span class="text-sm font-medium text-surface-600 dark:text-surface-300">Transaksi</span>
                            </div>
                            <span class="font-bold text-surface-800 dark:text-surface-100">24 Nota</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                                    <i class="pi pi-box"></i>
                                </div>
                                <span class="text-sm font-medium text-surface-600 dark:text-surface-300">Item Terjual</span>
                            </div>
                            <span class="font-bold text-surface-800 dark:text-surface-100">145 Pcs</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-700/50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                                    <i class="pi pi-exclamation-circle"></i>
                                </div>
                                <span class="text-sm font-medium text-surface-600 dark:text-surface-300">Piutang Jatuh Tempo</span>
                            </div>
                            <span class="font-bold text-red-600">3 Orang</span>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-0 dark:bg-surface-800 rounded-2xl shadow-sm border border-surface-100 dark:border-surface-700 p-5">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-surface-700 dark:text-surface-100 text-sm uppercase tracking-wider">Aktivitas Terakhir</h3>
                        <button class="text-xs text-primary-600 hover:underline">Lihat Semua</button>
                    </div>
                    
                    <div class="relative pl-2 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200 dark:before:bg-surface-700">
                        <div v-for="(act, idx) in recentActivities" :key="idx" class="relative pl-6">
                            <div class="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-surface-800"
                                :class="{
                                    'bg-emerald-500': act.type === 'in',
                                    'bg-red-500': act.type === 'out',
                                    'bg-gray-400': act.type === 'neutral'
                                }"></div>
                            
                            <div class="flex justify-between items-start">
                                <div>
                                    <h5 class="text-sm font-bold text-surface-800 dark:text-surface-200">{{ act.title }}</h5>
                                    <span class="text-xs text-surface-400 block mt-0.5">{{ act.time }}</span>
                                </div>
                                <span class="text-xs font-bold"
                                    :class="{
                                        'text-emerald-600': act.type === 'in',
                                        'text-red-600': act.type === 'out',
                                        'text-surface-500': act.type === 'neutral'
                                    }">
                                    {{ act.amount }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-pointer" @click="navigateTo('/product')">
                    <div class="relative z-10">
                        <h4 class="font-bold text-lg mb-1">Stok Menipis!</h4>
                        <p class="text-indigo-100 text-xs mb-3">Ada 5 barang yang stoknya di bawah batas minimum.</p>
                        <button class="bg-surface-0 hover:bg-surface-0 backdrop-blur-sm text-xs px-3 py-1.5 rounded-lg transition-colors">Cek Sekarang</button>
                    </div>
                    <i class="pi pi-bell text-6xl absolute -bottom-4 -right-4 opacity-20 rotate-12 group-hover:scale-110 transition-transform"></i>
                </div>

            </div>
        </div>

    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>