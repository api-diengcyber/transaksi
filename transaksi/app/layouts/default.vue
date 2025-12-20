<script setup>
import { ref, computed, onMounted, watch } from 'vue'; 
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth.store';
import { useAuthService } from '~/composables/useAuthService'; // Pastikan import ini ada

const config = useRuntimeConfig();
const router = useRouter();
const route = useRoute(); 
const authService = useAuthService();
const authStore = useAuthStore();

// Menggunakan computed untuk nama toko
const storeName = computed(() => authStore.activeStore?.name || 'RetailApp');
const primaryColorSetting = computed(() => authStore.getSetting('theme_primary_color', '#2563eb'));

const currentLogoUrl = computed(() => {
    const urlPath = authStore.getSetting('store_logo_url', null);
    if (!urlPath) return null;
    const baseUrl = config.public.apiBase.replace('/api', ''); 
    return urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
});

// --- THEME LOGIC ---
const isDark = ref(false);
const toggleDarkMode = () => {
    isDark.value = !isDark.value;
    if (process.client) {
        document.documentElement.classList.toggle('dark', isDark.value);
        localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    }
};

const applyPrimaryColor = (hexColor) => {
    if (process.client) {
        document.documentElement.style.setProperty('--app-primary-color', "#" + hexColor.replace('#', ''));
    }
}

watch(primaryColorSetting, (newColor) => {
    applyPrimaryColor(newColor);
}, { immediate: true }); 

onMounted(() => {
    if (process.client) {
        const theme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        isDark.value = (theme === 'dark' || (!theme && prefersDark));
        document.documentElement.classList.toggle('dark', isDark.value);
    }
});

// --- MENU STRUCTURE ---
const items = ref([
    { label: 'Dashboard', icon: 'pi pi-home', route: '/', key: 'dashboard' },
    { 
        label: 'Manajemen', 
        icon: 'pi pi-briefcase',
        key: 'manajemen',
        items: [
            { label: 'Produk', icon: 'pi pi-box', route: '/product' },
            { label: 'Restaurant', icon: 'pi pi-th-large', route: '/restaurant' },
            { label: 'Produksi', icon: 'pi pi-building', route: '/production' },
            { label: 'Stok/Gudang', icon: 'pi pi-warehouse', route: '/inventory' },
            { label: 'User/Pegawai', icon: 'pi pi-users', route: '/user' },
        ]
    },
    { 
        label: 'Transaksi', 
        icon: 'pi pi-wallet',
        key: 'transaksi',
        items: [
            { label: 'Penjualan / Pembelian', icon: 'pi pi-wallet', route: '/transaction' },
            { label: 'Piutang / Hutang', icon: 'pi pi-money-bill', route: '/arap' },
            { label: 'Jurnal', icon: 'pi pi-book', route: '/arap' }, // Route sementara sama
        ]
    },
    { 
        label: 'Laporan', 
        icon: 'pi pi-chart-bar', 
        key: 'report',
        items: [
             { label: 'Penjualan / Pembelian', icon: 'pi pi-chart-line', route: '/report/transaction' },
             { label: 'Piutang / Hutang', icon: 'pi pi-chart-line', route: '/report/arap' },
             { label: 'Produk / Stok', icon: 'pi pi-chart-line', route: '/report/arap' },
             { label: 'Produksi', icon: 'pi pi-chart-line', route: '/report/arap' },
        ]
    },
]);

// --- STORE SWITCHER LOGIC [BARU] ---
const storeMenu = ref();
const storeItems = computed(() => {
    // Mapping list toko dari pinia ke format menu PrimeVue
    return authStore.stores.map(store => ({
        label: store.name,
        icon: 'pi pi-building',
        // Highlight toko yang sedang aktif
        class: authStore.activeStore?.uuid === store.uuid ? 'font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : '',
        command: () => {
            // Panggil action switchStore
            authStore.switchStore(store.uuid);
        }
    }));
});

const toggleStoreMenu = (event) => {
    storeMenu.value.toggle(event);
};
// -----------------------------------

// --- PROFILE MENU ---
const profileMenu = ref();
const profileItems = ref([
    { 
        label: 'Pengaturan', 
        icon: 'pi pi-cog', 
        command: () => router.push('/setting')
    },
    { separator: true },
    { 
        label: 'Logout', 
        icon: 'pi pi-sign-out', 
        class: 'text-red-600 font-bold', 
        command: async () => await authService.logout()
    }
]);

const toggleProfile = (event) => {
    profileMenu.value.toggle(event);
};

// --- DESKTOP NAVIGATION ---
const desktopMenuRef = ref();
const desktopSubItems = ref([]);
const toggleDesktopSubMenu = (event, item) => {
    desktopSubItems.value = item.items.map(sub => ({
        ...sub,
        command: () => sub.route ? router.push(sub.route) : null
    }));
    desktopMenuRef.value.toggle(event);
};

// --- MOBILE NAVIGATION ---
const mobileMenuRef = ref();
const mobileSubItems = ref([]); 
const onMobileNavClick = (event, item) => {
    if (item.route && !item.items) {
        router.push(item.route);
    } else if (item.items) {
        mobileSubItems.value = item.items.map(sub => ({
            ...sub,
            command: () => sub.route ? router.push(sub.route) : null
        }));
        mobileMenuRef.value.toggle(event);
    }
};

const isRouteActive = (item) => {
    if (item.route) return route.path.startsWith(item.route) && item.route !== '/';
    if (item.route === '/' && route.path === '/') return true;
    if (item.items) return item.items.some(sub => sub.route && route.path.startsWith(sub.route));
    return false;
};
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
        
        <header class="sticky top-0 z-50 shadow-xl dark:shadow-black/50 bg-primary-600 dark:bg-primary-950/90 border-b border-primary-700 dark:border-primary-800 px-2 md:px-4 backdrop-blur-md bg-opacity-95">
            <div class="flex items-center h-16 w-full max-w-screen-2xl mx-auto" :style="`background-color: var(--app-primary-color); border-color: color-mix(in srgb, var(--app-primary-color) 90%, black);`">

                <NuxtLink to="/" class="flex items-center gap-3 group pl-2 shrink-0">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden shrink-0 bg-white text-primary-600">
                        <img v-if="currentLogoUrl" :src="currentLogoUrl" alt="Logo" class="w-full h-full object-cover" onerror="this.style.display='none'"/>
                        <span v-else>R</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-lg font-bold text-white tracking-tight leading-none group-hover:text-primary-100 transition-colors">
                            {{ storeName }}
                        </span>
                        <span class="text-[10px] text-primary-200 font-medium tracking-wide uppercase">
                            POS System
                        </span>
                    </div>
                </NuxtLink>

                <div class="hidden md:flex items-center gap-1 ml-8">
                    <template v-for="item in items" :key="item.label">
                        <NuxtLink v-if="item.route && !item.items" :to="item.route" 
                            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            :class="route.path === item.route ? 'bg-white/20 text-white shadow-inner' : 'text-primary-100 hover:bg-white/10 hover:text-white'">
                            <i :class="item.icon"></i>
                            <span>{{ item.label }}</span>
                        </NuxtLink>
                        <button v-else @click="(e) => toggleDesktopSubMenu(e, item)"
                            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 outline-none focus:ring-2 focus:ring-white/20"
                            :class="isRouteActive(item) ? 'bg-white/20 text-white shadow-inner' : 'text-primary-100 hover:bg-white/10 hover:text-white'">
                            <i :class="item.icon"></i>
                            <span>{{ item.label }}</span>
                            <i class="pi pi-angle-down text-xs opacity-70 ml-0.5"></i>
                        </button>
                    </template>
                </div>

                <div class="flex-1"></div>

                <div class="flex items-center gap-3 pr-2 shrink-0">
                    
                    <!-- <div class="hidden sm:block">
                        <button 
                            @click="toggleStoreMenu" 
                            class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors border border-white/10"
                            v-tooltip.bottom="'Pilih Cabang / Toko'"
                        >
                            <i class="pi pi-building text-primary-200"></i>
                            <span class="font-medium max-w-[100px] truncate">{{ authStore.activeStore?.name || 'Pilih Toko' }}</span>
                            <i class="pi pi-chevron-down text-xs opacity-70"></i>
                        </button>
                    </div> -->

                    <Button :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" text rounded severity="tertiary"
                        class="!w-10 !h-10 text-white hover:bg-white/10" @click="toggleDarkMode" />

                    <div class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        @click="toggleProfile" aria-haspopup="true" aria-controls="profile_menu">
                        <span class="hidden md:block text-sm text-white font-medium mr-1">Halo, {{ authStore.user?.username || 'User' }}</span>
                        <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" class="!bg-white !text-primary-600 font-bold" shape="circle" />
                        <i class="pi pi-chevron-down text-primary-100 text-xs hidden sm:block"></i>
                    </div>
                </div>

            </div>
        </header>

        <main class="flex-1 container mx-auto p-4 lg:p-6 max-w-screen-2xl w-full animate-fade-in pb-24 md:pb-6">
            <NuxtPage />
        </main>

        <footer class="border-t border-surface-200 dark:border-surface-800 py-6 mt-auto hidden md:block">
            <div class="container mx-auto px-4 text-center text-sm text-surface-500">
                &copy; 2025 {{ storeName }}. <span class="text-primary-600 font-bold">Powered by RetailApp</span>.
            </div>
        </footer>

        <nav class="md:hidden fixed bottom-0 left-0 right-0 border-t border-surface-200 dark:border-surface-800 z-50 bg-white dark:bg-surface-900 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div class="flex justify-around items-center h-16">
                 <button v-for="item in items" :key="item.label"
                    @click="(event) => onMobileNavClick(event, item)"
                    class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-all"
                    :class="isRouteActive(item) ? 'text-primary-600' : 'text-surface-500'">
                    <i :class="[item.icon, 'text-xl']"></i>
                    <span class="text-[10px] font-medium">{{ item.label }}</span>
                </button>
            </div>
        </nav>

        <Menu ref="storeMenu" :model="storeItems" :popup="true" class="w-64" />
        
        <Menu ref="profileMenu" id="profile_menu" :model="profileItems" :popup="true" class="mt-2 w-48" />
        <Menu ref="desktopMenuRef" :model="desktopSubItems" :popup="true" class="mt-2 w-48" />
        <Menu ref="mobileMenuRef" :model="mobileSubItems" :popup="true" class="!w-48 !mb-2" />

    </div>
</template>

<style scoped>
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>