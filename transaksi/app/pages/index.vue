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
        category: 'Transaksi',
        color: 'bg-green-500',
        items: [
            { label: 'Penjualan / Kasir', icon: 'pi pi-shopping-cart', route: '/transaction' },
            { label: 'Piutang / Hutang', icon: 'pi pi-money-bill', route: '/arap' },
        ]
    },
    {
        category: 'Manajemen',
        color: 'bg-blue-500',
        items: [
            { label: 'Master Produk', icon: 'pi pi-box', route: '/product' },
            { label: 'Restaurant / Meja', icon: 'pi pi-th-large', route: '/restaurant' },
            { label: 'Produksi', icon: 'pi pi-building', route: '/production' },
            { label: 'Stok/Gudang', icon: 'pi pi-warehouse', route: '/inventory' },
            { label: 'Pengaturan User', icon: 'pi pi-users', route: '/user' },
        ]
    },
    {
        category: 'Laporan',
        color: 'bg-orange-500',
        items: [
            { label: 'Laporan Transaksi', icon: 'pi pi-chart-line', route: '/report/transaction' },
            { label: 'Laporan Piutang/Hutang', icon: 'pi pi-chart-bar', route: '/report/arap' },
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
        
        <!-- HEADER SAMBUTAN -->
        <div class="bg-white dark:bg-surface-900 shadow-xl rounded-2xl p-6 border-l-4 border-primary-500 dark:border-primary-600">
            <h1 class="text-3xl font-extrabold text-surface-900 dark:text-surface-0 tracking-tight mb-1">
                Selamat Datang, <span class="text-primary-600 dark:text-primary-400">{{ userName }}</span>!
            </h1>
            <p class="text-surface-600 dark:text-surface-300">Anda sedang mengelola toko: **{{ storeName }}**.</p>
        </div>

        <!-- STATISTIK RINGKAS (Placeholder) -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-surface-900 shadow-lg rounded-xl p-5 border border-surface-200 dark:border-surface-800 flex flex-col justify-between h-32">
                <div class="text-xs font-bold text-surface-400 uppercase tracking-wider">Penjualan Hari Ini</div>
                <div class="text-3xl font-extrabold text-green-600">Rp 12.500.000</div>
                <div class="text-xs text-surface-500 flex items-center gap-1">
                    <i class="pi pi-arrow-up text-green-500"></i> 12% dari kemarin
                </div>
            </div>
            
            <div class="bg-white dark:bg-surface-900 shadow-lg rounded-xl p-5 border border-surface-200 dark:border-surface-800 flex flex-col justify-between h-32">
                <div class="text-xs font-bold text-surface-400 uppercase tracking-wider">Total Stok Tersedia</div>
                <div class="text-3xl font-extrabold text-blue-600">1,245 Unit</div>
                <div class="text-xs text-surface-500 flex items-center gap-1">
                    <i class="pi pi-box text-blue-500"></i> Di 4 Lokasi Rak
                </div>
            </div>

            <div class="bg-white dark:bg-surface-900 shadow-lg rounded-xl p-5 border border-surface-200 dark:border-surface-800 flex flex-col justify-between h-32">
                <div class="text-xs font-bold text-surface-400 uppercase tracking-wider">Piutang Belum Dibayar</div>
                <div class="text-3xl font-extrabold text-red-600">Rp 4.100.000</div>
                <div class="text-xs text-surface-500 flex items-center gap-1">
                    <i class="pi pi-arrow-right text-red-500"></i> Dari 5 Pelanggan
                </div>
            </div>

            <div class="bg-white dark:bg-surface-900 shadow-lg rounded-xl p-5 border border-surface-200 dark:border-surface-800 flex flex-col justify-between h-32">
                <div class="text-xs font-bold text-surface-400 uppercase tracking-wider">Resep Aktif</div>
                <div class="text-3xl font-extrabold text-purple-600">23 Menu</div>
                <div class="text-xs text-surface-500 flex items-center gap-1">
                    <i class="pi pi-book text-purple-500"></i> Siap Produksi
                </div>
            </div>
        </div>

        <!-- MENU AKSI CEPAT -->
        <div class="space-y-6">
            <div v-for="section in quickActions" :key="section.category" class="space-y-4">
                <h2 class="text-xl font-bold text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <div :class="[section.color, 'w-2 h-2 rounded-full shadow-lg']"></div>
                    {{ section.category }}
                </h2>

                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    <div v-for="item in section.items" :key="item.label" 
                        @click="navigateTo(item.route)"
                        class="bg-white dark:bg-surface-900 rounded-xl shadow-md border border-surface-200 dark:border-surface-800 p-4 cursor-pointer hover:shadow-lg hover:border-primary-400 transition-all active:scale-[0.98] group"
                    >
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors" :class="section.color">
                            <i :class="[item.icon, 'text-white text-xl']"></i>
                        </div>
                        <div class="font-semibold text-sm text-surface-800 dark:text-surface-100 group-hover:text-primary-600">
                            {{ item.label }}
                        </div>
                        <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{{ item.description || '' }}</p>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>