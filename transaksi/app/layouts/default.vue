<script setup>
import { ref, computed } from 'vue'; 
import { useRouter } from 'vue-router';
import { useAuthStore } from '~/stores/auth.store'; 

const router = useRouter();
const authService = useAuthService();
const authStore = useAuthStore();

const storeName = computed(() => authStore.activeStore?.name || 'RetailApp');

// --- MENU UTAMA ---
const items = ref([
    { label: 'Dashboard', icon: 'pi pi-home', route: '/' },
    { 
        label: 'Manajemen', 
        icon: 'pi pi-briefcase',
        items: [
            { label: 'Produk', icon: 'pi pi-box', route: '/product' }, // Pastikan route benar (/products bukan /product jika file indexnya di folder products)
        ]
    },
    { 
        label: 'Transaksi', 
        icon: 'pi pi-wallet',
        items: [
            { label: 'Penjualan', icon: 'pi pi-shopping-cart', route: '/transaction/sale' }, // Sesuaikan route
            { label: 'Pembelian', icon: 'pi pi-truck', route: '/transaction/buy' }, // Sesuaikan route
        ]
    },
    { 
        label: 'Laporan', 
        icon: 'pi pi-chart-bar',
        items: [
            { label: 'Laporan Penjualan', icon: 'pi pi-file-pdf', route: '/report/sale' },
            { label: 'Laporan Pembelian', icon: 'pi pi-shopping-bag', route: '/report/buy' },
            { label: 'Grafik Analisis', icon: 'pi pi-chart-line', route: '/report/graph' },
        ]
    }
]);

// --- MENU PROFIL ---
const profileMenu = ref();
const profileItems = ref([
    { 
        label: 'Pengaturan', 
        icon: 'pi pi-cog', 
        command: () => {
            router.push('/setting');
        }
    },
    { separator: true },
    { 
        label: 'Logout', 
        icon: 'pi pi-sign-out', 
        class: 'text-red-600', 
        command: async () => { 
            await authService.logout();
        }
    }
]);

const toggleProfile = (event) => {
    profileMenu.value.toggle(event);
};
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
        
        <header class="sticky top-0 z-50 shadow-lg bg-primary-600 dark:bg-primary-900 border-b border-primary-700 px-4">
            <Menubar :model="items" class="!bg-transparent !border-none px-4 lg:px-8 h-16 !rounded-none">
                
                <template #start>
                    <NuxtLink to="/" class="flex items-center gap-3 mr-8 group">
                        <div class="w-9 h-9 bg-white text-primary-600 rounded-lg flex items-center justify-center font-black text-xl shadow-sm group-hover:scale-105 transition-transform">
                            R
                        </div>
                        <div class="flex flex-col">
                             <span class="text-lg font-bold text-white tracking-tight leading-none group-hover:text-blue-100 transition-colors">
                                {{ storeName }}
                            </span>
                            <span class="text-[10px] text-blue-200 font-medium tracking-wide uppercase">
                                POS System
                            </span>
                        </div>
                    </NuxtLink>
                </template>

                <template #item="{ item, props, hasSubmenu, root }">
                    <NuxtLink v-if="item.route && !hasSubmenu" v-slot="{ href, navigate, isActive }" :to="item.route" custom>
                        <a :href="href" v-bind="props.action" @click="navigate" 
                           :class="[
                               'flex items-center px-3 py-2 rounded-md transition-all duration-200 font-medium text-sm',
                               root && isActive ? 'bg-white/20 text-white shadow-sm' : '',
                               root && !isActive ? 'text-blue-100 hover:bg-white/10 hover:text-white' : '',
                               !root && isActive ? 'bg-primary-50 text-primary-700 font-semibold' : '', 
                               !root && !isActive ? 'text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-primary-600' : ''
                           ]">
                            <span :class="[item.icon, 'mr-2']" />
                            <span>{{ item.label }}</span>
                        </a>
                    </NuxtLink>

                    <a v-else :href="item.url" :target="item.target" v-bind="props.action" 
                       :class="[
                           'flex items-center px-3 py-2 rounded-md group cursor-pointer transition-all duration-200 font-medium text-sm',
                           root ? 'text-blue-100 hover:bg-white/10 hover:text-white' : 
                           'text-surface-700 hover:bg-surface-100 hover:text-primary-600'
                       ]">
                        <span :class="[item.icon, 'mr-2 transition-colors']" />
                        <span class="transition-colors">{{ item.label }}</span>
                        <span v-if="hasSubmenu" class="pi pi-angle-down ml-2 text-xs opacity-70" />
                    </a>
                </template>

                <template #end>
                    <div class="flex items-center gap-2 md:gap-3">
                        <div class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors ml-1"
                             @click="toggleProfile"
                             aria-haspopup="true" 
                             aria-controls="profile_menu">
                            
                            <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" class="!bg-white !text-primary-600 font-bold border-2 border-primary-400/50" shape="circle" />
                            <i class="pi pi-chevron-down text-blue-100 text-xs hidden sm:block"></i>
                        </div>

                        <Menu ref="profileMenu" id="profile_menu" :model="profileItems" :popup="true" class="mt-2 w-48" />
                    </div>
                </template>

            </Menubar>
        </header>

        <main class="flex-1 container mx-auto p-4 lg:p-6 max-w-screen-2xl w-full animate-fade-in">
            <NuxtPage />
        </main>

        <footer class="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 py-6 mt-auto">
            <div class="container mx-auto px-4 text-center text-sm text-surface-500">
                &copy; 2025 {{ storeName }}. <span class="text-primary-600 font-bold">Powered by RetailApp</span>.
            </div>
        </footer>
    </div>
</template>

<style scoped>
:deep(.p-menubar) { padding: 0; }
:deep(.p-menubar-root-list) { z-index: 100; }

/* Dropdown Menu Utama */
:deep(.p-submenu-list) {
    background-color: #ffffff !important;
    border: 1px solid var(--p-surface-200) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) !important;
    padding: 0.5rem !important;
    min-width: 180px !important;
}

/* Style Popup Menu Profil (Override Global) */
:deep(.p-menu) {
    background-color: #ffffff !important;
    border: 1px solid var(--p-surface-200) !important;
    color: var(--p-surface-700) !important;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1) !important;
    border-radius: 0.5rem !important;
    z-index: 9999 !important; /* Pastikan di atas elemen lain */
}

/* Item link dalam menu */
:deep(.p-menu .p-menuitem-link), :deep(.p-submenu-list .p-menuitem-link) {
    padding: 0.75rem 1rem !important;
    color: var(--p-surface-700) !important;
    transition: all 0.2s !important;
}

/* Hover State */
:deep(.p-menu .p-menuitem-link:hover), :deep(.p-submenu-list .p-menuitem-link:hover) {
    background-color: var(--p-primary-50) !important;
    color: var(--p-primary-600) !important;
}

/* Icon Style */
:deep(.p-menu .p-menuitem-icon), :deep(.p-submenu-list .p-menuitem-icon) {
    color: var(--p-surface-500);
    margin-right: 0.75rem;
}
:deep(.p-menu .p-menuitem-link:hover .p-menuitem-icon), :deep(.p-submenu-list .p-menuitem-link:hover .p-menuitem-icon) {
    color: var(--p-primary-600);
}
</style>