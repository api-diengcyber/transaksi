<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '~/stores/auth.store';

definePageMeta({ layout: 'default' });

const router = useRouter();
const authStore = useAuthStore();

// --- STATE & DATA ---

const userName = computed(() => authStore.user?.username || 'Pengguna');
const storeName = computed(() => authStore.activeStore?.name || 'Toko Default');

// [UPDATE] Definisi Menu Aksi Cepat Dashboard sesuai dengan Struktur Navigasi
const quickActions = [
    {
        category: 'Transaksi Cepat',
        color: 'bg-green-600',
        icon: 'pi pi-wallet',
        items: [
            { label: 'Kasir Penjualan', icon: 'pi pi-shopping-cart', route: '/transaction' },
            { label: 'Pembelian Stok', icon: 'pi pi-download', route: '/transaction?tab=buy' },
            { label: 'Retur Barang', icon: 'pi pi-arrow-left-to-line', route: '/transaction?tab=return' },
            { label: 'Piutang / Hutang', icon: 'pi pi-money-bill', route: '/arap' },
        ]
    },
    {
        category: 'Manajemen Stok & Data',
        color: 'bg-blue-600',
        icon: 'pi pi-briefcase',
        items: [
            { label: 'Master Produk', icon: 'pi pi-box', route: '/product' },
            { label: 'Inventaris & Gudang', icon: 'pi pi-warehouse', route: '/inventory' },
            { label: 'Order Produksi', icon: 'pi pi-building', route: '/production' },
            { label: 'Pengaturan User', icon: 'pi pi-users', route: '/user' },
            { label: 'Resto / Tata Meja', icon: 'pi pi-th-large', route: '/restaurant' },
        ]
    },
    {
        category: 'Laporan Transaksi',
        color: 'bg-orange-600',
        icon: 'pi pi-chart-bar',
        items: [
            { label: 'Laporan Transaksi', icon: 'pi pi-chart-line', route: '/report/transaction' },
            { label: 'Laporan Pembelian', icon: 'pi pi-chart-pie', route: '/report/transaction?tab=buy' },
            { label: 'Laporan Piutang/Hutang', icon: 'pi pi-book', route: '/report/arap' },
            { label: 'Analisis Grafik', icon: 'pi pi-chart-line', route: '/report/graph' },
        ]
    },
];

// --- HANDLERS ---
const navigateTo = (route) => {
    router.push(route);
};
</script>

<template>
    <div class="animate-fade-in space-y-8">
        
        <div class="light:bg-white dark:bg-dark shadow-2xl rounded-2xl p-8 border-t-8 border-primary-600 dark:border-primary-700 relative overflow-hidden">
            <i class="pi pi-bolt text-[8rem] text-primary-500/10 dark:text-primary-400/10 absolute -top-10 -right-10 rotate-12"></i>
            <h1 class="text-4xl font-black text-surface-900 dark:text-surface-0 tracking-tight mb-2 relative z-10">
                Halo, <span class="text-primary-600 dark:text-primary-400">{{ userName }}</span>!
            </h1>
            <p class="text-lg text-surface-600 dark:text-surface-300">Selamat bekerja di **{{ storeName }}**. Mari optimalkan penjualan hari ini!</p>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div class="light:bg-white dark:bg-surface-500 shadow-xl rounded-2xl p-5 border border-surface-200 dark:border-surface-800 flex items-center gap-4 group hover:border-emerald-500 transition-all">
                <div class="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0">
                    <i class="pi pi-chart-line text-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider">Penjualan Hari Ini</div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">Rp 12.5 Jt</div>
                    <div class="text-[10px] text-surface-500 flex items-center gap-1">
                        <i class="pi pi-arrow-up text-emerald-500"></i> 12% dari kemarin
                    </div>
                </div>
            </div>
            
            <div class="light:bg-white dark:bg-surface-500 shadow-xl rounded-2xl p-5 border border-surface-200 dark:border-surface-800 flex items-center gap-4 group hover:border-blue-500 transition-all">
                <div class="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                    <i class="pi pi-box text-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Stok</div>
                    <div class="text-2xl font-black text-blue-600 dark:text-blue-400">1,245 Unit</div>
                    <div class="text-[10px] text-surface-500 flex items-center gap-1">
                        <i class="pi pi-warehouse text-blue-500"></i> Di 4 Gudang
                    </div>
                </div>
            </div>

            <div class="light:bg-white dark:bg-surface-500 shadow-xl rounded-2xl p-5 border border-surface-200 dark:border-surface-800 flex items-center gap-4 group hover:border-red-500 transition-all">
                <div class="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                    <i class="pi pi-money-bill text-2xl text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider">Piutang Belum Dibayar</div>
                    <div class="text-2xl font-black text-red-600 dark:text-red-400">Rp 4.1 Jt</div>
                    <div class="text-[10px] text-surface-500 flex items-center gap-1">
                        <i class="pi pi-calendar text-red-500"></i> 5 Nota Jatuh Tempo
                    </div>
                </div>
            </div>

            <div class="light:bg-white dark:bg-surface-500 shadow-xl rounded-2xl p-5 border border-surface-200 dark:border-surface-800 flex items-center gap-4 group hover:border-purple-500 transition-all">
                <div class="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shrink-0">
                    <i class="pi pi-book text-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform"></i>
                </div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider">Order Produksi Aktif</div>
                    <div class="text-2xl font-black text-purple-600 dark:text-purple-400">23 Batch</div>
                    <div class="text-[10px] text-surface-500 flex items-center gap-1">
                        <i class="pi pi-hourglass text-purple-500"></i> Sedang diproses
                    </div>
                </div>
            </div>
        </div>

        <div class="space-y-10 pt-4">
            <div v-for="section in quickActions" :key="section.category" class="space-y-4">
                
                <h2 class="text-2xl font-black text-surface-800 dark:text-surface-100 flex items-center gap-3 border-l-4 pl-3"
                    :style="`border-color: var(--app-primary-color);`">
                    <i :class="[section.icon, 'text-xl', section.color]"></i>
                    {{ section.category }}
                </h2>

                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <div v-for="item in section.items" :key="item.label" 
                        @click="navigateTo(item.route)"
                        class="light:bg-white dark:bg-surface-500 rounded-xl shadow-md border border-surface-200 dark:border-surface-800 p-5 cursor-pointer hover:shadow-xl hover:border-primary-500 transition-all active:scale-[0.98] group"
                    >
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors" :class="section.color">
                            <i :class="[item.icon, 'text-white text-2xl group-hover:scale-110 transition-transform']"></i>
                        </div>
                        <div class="font-bold text-base text-surface-800 dark:text-surface-100 group-hover:text-primary-600">
                            {{ item.label }}
                        </div>
                        </div>
                </div>
            </div>
        </div>

    </div>
</template>