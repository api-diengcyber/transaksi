<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '~/stores/auth.store';
import { useRouter } from 'vue-router';
import { useDashboardService } from '~/composables/useDashboardService';

definePageMeta({ layout: 'default' });

const router = useRouter();
const authStore = useAuthStore();
const dashboardService = useDashboardService();

// --- STATE & DATA ---
const userName = computed(() => authStore.user?.username || 'Pengguna');
const storeName = computed(() => authStore.activeStore?.name || 'Toko Default');
const greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 18) return 'Selamat Siang';
    return 'Selamat Malam';
});

// State API Dashboard
const isLoading = ref(true);
const summaryData = ref({
    todayRevenue: 0,
    todayTransactions: 0,
    todayItemsSold: 0,
    dueReceivables: 0,
    lowStockItems: 0,
    recentActivities: []
});

const loadDashboardData = async () => {
    if (!authStore.activeStore?.uuid) return;
    isLoading.value = true;
    try {
        const res = await dashboardService.getSummary(authStore.activeStore.uuid);
        summaryData.value = res.data || res;
    } catch (e) {
        console.error('Gagal memuat data dashboard', e);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    loadDashboardData();
});

// Jika user ganti toko dari header, dashboard otomatis ter-refresh
watch(() => authStore.activeStore?.uuid, () => {
    loadDashboardData();
});

const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

// --- MENU DATA ---
const quickMenu = [
    { title: 'Kasir & Penjualan', desc: 'Buka sistem POS', icon: 'pi pi-shopping-cart', color: 'from-emerald-500 to-teal-600', route: '/sale' },
    { title: 'Pembelian Stok', desc: 'Input stok masuk', icon: 'pi pi-shopping-bag', color: 'from-blue-500 to-indigo-600', route: '/buy' },
    { title: 'Data Produk', desc: 'Kelola master barang', icon: 'pi pi-box', color: 'from-violet-500 to-purple-600', route: '/product' },
    { title: 'Analisa POS', desc: 'Cek grafik & omset', icon: 'pi pi-chart-pie', color: 'from-orange-500 to-amber-600', route: '/report/graph' }
];

const transaksiMenu = [
    { label: 'Penjualan', icon: 'pi pi-shopping-cart', route: '/sale', color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Pembelian', icon: 'pi pi-shopping-bag', route: '/buy', color: 'text-blue-500 bg-blue-50' },
    { label: 'Retur Jual', icon: 'pi pi-refresh', route: '/return/sale', color: 'text-rose-500 bg-rose-50' },
    { label: 'Retur Beli', icon: 'pi pi-refresh', route: '/return/buy', color: 'text-pink-500 bg-pink-50' },
    { label: 'Piutang', icon: 'pi pi-arrow-circle-down', route: '/ar', color: 'text-amber-500 bg-amber-50' },
    { label: 'Hutang', icon: 'pi pi-arrow-circle-up', route: '/ap', color: 'text-orange-500 bg-orange-50' },
    { label: 'Keuangan', icon: 'pi pi-book', route: '/financial', color: 'text-cyan-500 bg-cyan-50' },
];

const manajemenMenu = [
    { label: 'Produk', icon: 'pi pi-box', route: '/product', color: 'text-blue-500 bg-blue-50' },
    { label: 'Stok/Gudang', icon: 'pi pi-database', route: '/inventory', color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Restaurant', icon: 'pi pi-th-large', route: '/restaurant', color: 'text-orange-500 bg-orange-50' },
    { label: 'Ekspedisi', icon: 'pi pi-truck', route: '/courier', color: 'text-cyan-500 bg-cyan-50' },
    // { label: 'Bank & Rek.', icon: 'pi pi-building-columns', route: '/bank', color: 'text-indigo-500 bg-indigo-50' },
    // { label: 'Member', icon: 'pi pi-user', route: '/member', color: 'text-pink-500 bg-pink-50' },
    // { label: 'Supplier', icon: 'pi pi-address-book', route: '/supplier', color: 'text-rose-500 bg-rose-50' },
    { label: 'Pegawai', icon: 'pi pi-id-card', route: '/user', color: 'text-violet-500 bg-violet-50' },
    { label: 'Media', icon: 'pi pi-image', route: '/media', color: 'text-fuchsia-500 bg-fuchsia-50' },
];

const laporanMenu = [
    { label: 'Penjualan', icon: 'pi pi-percentage', route: '/report/sale', color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Pembelian', icon: 'pi pi-wallet', route: '/report/buy', color: 'text-blue-500 bg-blue-50' },
    { label: 'Retur Jual', icon: 'pi pi-replay', route: '/report/return/sale', color: 'text-rose-500 bg-rose-50' },
    { label: 'Retur Beli', icon: 'pi pi-replay', route: '/report/return/buy', color: 'text-pink-500 bg-pink-50' },
    { label: 'Piutang', icon: 'pi pi-file-excel', route: '/report/ar', color: 'text-amber-500 bg-amber-50' },
    { label: 'Hutang', icon: 'pi pi-file-pdf', route: '/report/ap', color: 'text-orange-500 bg-orange-50' },
    { label: 'Stok / Gudang', icon: 'pi pi-database', route: '/report/inventory', color: 'text-cyan-500 bg-cyan-50' },
    { label: 'Analisa POS', icon: 'pi pi-chart-pie', route: '/report/graph', color: 'text-purple-500 bg-purple-50' },
    { label: 'Keuangan', icon: 'pi pi-file-pdf', route: '/report/financial', color: 'text-indigo-500 bg-indigo-50' },
];

const navigateTo = (path) => router.push(path);
</script>

<template>
    <div class="animate-fade-in min-h-full flex flex-col gap-8">
        
        <div class="relative bg-gradient-to-r from-primary-500 to-primary-200 rounded-3xl p-8 lg:p-10 shadow-2xl overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-surface-0 opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            <div class="absolute bottom-0 left-0 w-48 h-48 bg-primary-400 opacity-10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
            
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-0 backdrop-blur-md border border-white/10 text-xs font-medium mb-3">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        {{ storeName }} Active
                    </div>
                    <h1 class="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-white">
                        {{ greeting }}, <span class="text-primary-100">{{ userName }}</span>!
                    </h1>
                    <p class="text-primary-50 text-sm md:text-base max-w-lg leading-relaxed">
                        Siap untuk mengelola toko hari ini? Berikut ringkasan performa dan menu operasional untuk Anda.
                    </p>
                </div>
                <div class="hidden md:block text-right text-white">
                    <Skeleton v-if="isLoading" width="12rem" height="3rem" class="mb-2 bg-white/20" />
                    <div v-else class="text-4xl font-black mb-1">{{ formatCurrency(summaryData.todayRevenue) }}</div>
                    <div class="text-sm text-primary-100 font-medium">Omset Hari Ini <i class="pi pi-arrow-up text-emerald-300 ml-1 font-bold"></i></div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-2 space-y-8">
                
                <div>
                    <h3 class="text-lg font-bold mb-4 flex items-center gap-2 text-surface-800">
                        <i class="pi pi-bolt text-amber-500"></i> Aksi Cepat
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div v-for="item in quickMenu" :key="item.title" 
                             @click="navigateTo(item.route)"
                             class="group relative overflow-hidden bg-surface-0 p-5 rounded-2xl border border-surface-200 shadow-sm hover:shadow-lg transition-all cursor-pointer">
                            
                            <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 rounded-bl-full transition-transform group-hover:scale-110" :class="item.color"></div>
                            
                            <div class="relative z-10 flex items-start gap-4">
                                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br" :class="item.color">
                                    <i :class="[item.icon, 'text-xl']"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-lg text-surface-800 group-hover:text-primary-600 transition-colors">{{ item.title }}</h4>
                                    <p class="text-xs text-surface-500 mt-1 line-clamp-2">{{ item.desc }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-0 p-5 rounded-2xl border border-surface-200 shadow-sm">
                    <h3 class="text-base font-bold mb-4 flex items-center gap-2 text-surface-800 border-b border-surface-100 pb-3">
                        <i class="pi pi-shopping-cart text-primary-500"></i> Modul Transaksi
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <div v-for="item in transaksiMenu" :key="item.label"
                             @click="navigateTo(item.route)"
                             class="flex flex-col items-center justify-center gap-2 p-3 bg-surface-50 border border-transparent rounded-xl hover:border-primary-200 hover:shadow-sm cursor-pointer transition-all group">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" :class="item.color">
                                <i :class="[item.icon, 'text-lg']"></i>
                            </div>
                            <span class="text-[11px] font-bold text-surface-600 text-center uppercase tracking-wider">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-0 p-5 rounded-2xl border border-surface-200 shadow-sm">
                    <h3 class="text-base font-bold mb-4 flex items-center gap-2 text-surface-800 border-b border-surface-100 pb-3">
                        <i class="pi pi-briefcase text-primary-500"></i> Modul Manajemen
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <div v-for="item in manajemenMenu" :key="item.label"
                             @click="navigateTo(item.route)"
                             class="flex flex-col items-center justify-center gap-2 p-3 bg-surface-50 border border-transparent rounded-xl hover:border-primary-200 hover:shadow-sm cursor-pointer transition-all group">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" :class="item.color">
                                <i :class="[item.icon, 'text-lg']"></i>
                            </div>
                            <span class="text-[11px] font-bold text-surface-600 text-center uppercase tracking-wider">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-0 p-5 rounded-2xl border border-surface-200 shadow-sm">
                    <h3 class="text-base font-bold mb-4 flex items-center gap-2 text-surface-800 border-b border-surface-100 pb-3">
                        <i class="pi pi-chart-bar text-primary-500"></i> Modul Laporan
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <div v-for="item in laporanMenu" :key="item.label"
                             @click="navigateTo(item.route)"
                             class="flex flex-col items-center justify-center gap-2 p-3 bg-surface-50 border border-transparent rounded-xl hover:border-primary-200 hover:shadow-sm cursor-pointer transition-all group">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110" :class="item.color">
                                <i :class="[item.icon, 'text-lg']"></i>
                            </div>
                            <span class="text-[11px] font-bold text-surface-600 text-center uppercase tracking-wider truncate w-full px-1">{{ item.label }}</span>
                        </div>
                    </div>
                </div>

            </div>

            <div class="space-y-6">
                
                <div class="bg-surface-0 rounded-2xl shadow-sm border border-surface-200 p-5">
                    <h3 class="font-bold mb-4 text-sm uppercase tracking-wider text-surface-700">Ringkasan Hari Ini</h3>
                    <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-100">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <i class="pi pi-receipt"></i>
                                </div>
                                <span class="text-sm font-bold text-surface-600">Transaksi</span>
                            </div>
                            <Skeleton v-if="isLoading" width="3rem" class="mb-2" />
                            <span v-else class="font-black text-surface-800">{{ summaryData.todayTransactions }} Nota</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-100">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                                    <i class="pi pi-box"></i>
                                </div>
                                <span class="text-sm font-bold text-surface-600">Item Terjual</span>
                            </div>
                            <Skeleton v-if="isLoading" width="3rem" class="mb-2" />
                            <span v-else class="font-black text-surface-800">{{ summaryData.todayItemsSold }} Pcs</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-surface-50 rounded-xl border border-surface-100">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                                    <i class="pi pi-exclamation-circle"></i>
                                </div>
                                <span class="text-sm font-bold text-surface-600">Piutang Jatuh Tempo</span>
                            </div>
                            <Skeleton v-if="isLoading" width="3rem" class="mb-2" />
                            <span v-else class="font-black text-red-600">{{ summaryData.dueReceivables }} Orang</span>
                        </div>
                    </div>
                </div>

                <div class="bg-surface-0 rounded-2xl shadow-sm border border-surface-200 p-5">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-sm uppercase tracking-wider text-surface-700">Aktivitas Terakhir</h3>
                        <button class="text-xs font-bold text-primary-600 hover:underline">Lihat Semua</button>
                    </div>
                    
                    <div v-if="isLoading" class="space-y-4">
                        <Skeleton v-for="i in 3" :key="i" height="3rem" borderRadius="16px" />
                    </div>
                    
                    <div v-else-if="summaryData.recentActivities.length > 0" class="relative pl-2 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-200">
                        <div v-for="(act, idx) in summaryData.recentActivities" :key="idx" class="relative pl-6 animate-fade-in" :style="{animationDelay: `${idx * 0.1}s`}">
                            <div class="absolute left-[-5px] top-1.5 w-3.5 h-3.5 rounded-full border-[3px] border-surface-0"
                                :class="{
                                    'bg-emerald-500': act.type === 'in',
                                    'bg-red-500': act.type === 'out',
                                    'bg-surface-400': act.type === 'neutral'
                                }"></div>
                            
                            <div class="flex justify-between items-start">
                                <div>
                                    <h5 class="text-sm font-bold text-surface-800">{{ act.title }}</h5>
                                    <span class="text-xs font-medium text-surface-400 block mt-0.5">{{ act.time }}</span>
                                </div>
                                <span class="text-xs font-black"
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
                    
                    <div v-else class="text-center py-6 text-surface-400 text-sm">
                        <i class="pi pi-inbox text-3xl mb-2"></i>
                        <p>Belum ada aktivitas hari ini.</p>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-indigo-500/30 transition-shadow" @click="navigateTo('/inventory')">
                    <div class="relative z-10">
                        <h4 class="font-black text-lg mb-1">Stok Menipis!</h4>
                        <Skeleton v-if="isLoading" width="8rem" class="mb-4 bg-white/20" />
                        <p v-else class="text-indigo-100 text-xs mb-4 font-medium">Ada {{ summaryData.lowStockItems }} barang yang stoknya di bawah batas minimum.</p>
                        <button class="bg-white/20 hover:bg-white/30 backdrop-blur-sm font-bold text-xs px-4 py-2 rounded-lg transition-colors border border-white/30">Cek Gudang Sekarang</button>
                    </div>
                    <i class="pi pi-bell text-7xl absolute -bottom-4 -right-4 opacity-20 rotate-12 group-hover:scale-110 transition-transform"></i>
                </div>

            </div>
        </div>

    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>