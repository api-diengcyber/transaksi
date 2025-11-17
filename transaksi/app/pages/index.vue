<script setup>
import { ref } from 'vue';

// Data Shortcut Menu
const menus = ref([
    {
        title: 'TRANSAKSI',
        items: [
            { 
                label: 'Penjualan Baru', 
                icon: 'pi pi-shopping-cart', 
                route: '/transaction/sale', 
                desc: 'Kasir / POS',
                color: 'text-emerald-600', 
                bg: 'bg-emerald-100 dark:bg-emerald-900/20' 
            },
            { 
                label: 'Pembelian Stok', 
                icon: 'pi pi-truck', 
                route: '/transaction/buy', 
                desc: 'Pembelian Barang',
                color: 'text-orange-600', 
                bg: 'bg-orange-100 dark:bg-orange-900/20' 
            },
            { 
                label: 'Retur Barang', 
                icon: 'pi pi-refresh', 
                route: '/transaksi/retur', 
                desc: 'Pengembalian',
                color: 'text-red-600', 
                bg: 'bg-red-100 dark:bg-red-900/20' 
            }
        ]
    },
    {
        title: 'MANAJEMEN',
        items: [
            { 
                label: 'Master Produk', 
                icon: 'pi pi-box', 
                route: '/product', 
                desc: 'Kelola Item & Harga',
                color: 'text-blue-600', 
                bg: 'bg-blue-100 dark:bg-blue-900/20' 
            }
        ]
    },
    {
        title: 'LAPORAN & ANALISIS',
        items: [
            { 
                label: 'Laporan Penjualan', 
                icon: 'pi pi-file-pdf', 
                route: '/report/sale', 
                desc: 'Rekap Omset',
                color: 'text-purple-600', 
                bg: 'bg-purple-100 dark:bg-purple-900/20' 
            },
            { 
                label: 'Laporan Pembelian', 
                icon: 'pi pi-shopping-bag', 
                route: '/report/buy', 
                desc: 'Rekap Pengeluaran',
                color: 'text-indigo-600', 
                bg: 'bg-indigo-100 dark:bg-indigo-900/20' 
            },
            { 
                label: 'Grafik Analisis', 
                icon: 'pi pi-chart-line', 
                route: '/report/graph', 
                desc: 'Tren Bisnis',
                color: 'text-cyan-600', 
                bg: 'bg-cyan-100 dark:bg-cyan-900/20' 
            }
        ]
    }
]);

definePageMeta({
    layout: 'default'
});
</script>

<template>
    <div class="p-4 md:p-8 animate-fade-in">
        
        <div class="mb-10 bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            <div class="relative z-10">
                <h1 class="text-3xl md:text-4xl font-bold mb-2">Halo, Admin! 👋</h1>
                <p class="text-primary-100 text-lg">Selamat datang kembali di RetailApp. Apa yang ingin Anda lakukan hari ini?</p>
            </div>
            <i class="pi pi-chart-bar absolute -right-5 -bottom-10 text-[10rem] text-white opacity-10 rotate-12"></i>
        </div>

        <div v-for="(group, index) in menus" :key="index" class="mb-10">
            
            <h2 class="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-4 ml-1 border-b border-surface-200 dark:border-surface-700 pb-2 inline-block">
                {{ group.title }}
            </h2>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <NuxtLink 
                    v-for="item in group.items" 
                    :key="item.label" 
                    :to="item.route"
                    class="group relative bg-white dark:bg-surface-900 p-6 rounded-2xl border border-surface-100 dark:border-surface-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                    <div class="flex items-start justify-between mb-4">
                        <div :class="['w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner', item.bg, item.color]">
                            <i :class="item.icon"></i>
                        </div>
                        
                        <div class="w-8 h-8 rounded-full bg-surface-50 dark:bg-surface-800 flex items-center justify-center text-surface-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                            <i class="pi pi-arrow-right text-sm"></i>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-xl font-bold text-surface-800 dark:text-surface-100 mb-1 group-hover:text-primary-600 transition-colors">
                            {{ item.label }}
                        </h3>
                        <p class="text-sm text-surface-500 dark:text-surface-400">
                            {{ item.desc }}
                        </p>
                    </div>
                </NuxtLink>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* Animasi halus saat masuk */
.animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>