<script setup>
import { ref, computed, onMounted } from 'vue'; 
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth.store';

const config = useRuntimeConfig();

const router = useRouter();
const route = useRoute(); 
const authService = useAuthService();
const authStore = useAuthStore();

// Menggunakan computed untuk nama toko
const storeName = computed(() => authStore.activeStore?.name || 'RetailApp');

// [BARU] Computed untuk mengambil warna primer dari Store
const primaryColorSetting = computed(() => authStore.getSetting('theme_primary_color', '#2563eb'));

// [BARU] Computed untuk menghasilkan URL Logo yang lengkap dan dapat diakses
const currentLogoUrl = computed(() => {
    // Ambil URL path dari settings (misal: /uploads/xxx.jpg)
    const urlPath = authStore.getSetting('store_logo_url', null);
    
    // Jika tidak ada path, kembali ke null atau string kosong
    if (!urlPath) return null;

    // Konstruksi Base URL API (misal: http://localhost:3000)
    const baseUrl = config.public.apiBase.replace('/api', ''); 

    // Gabungkan Base URL dengan path
    return urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
});

// --- THEME LOGIC ---
const isDark = ref(false);

const toggleDarkMode = () => {
    isDark.value = !isDark.value;
    if (process.client) {
        // Toggle class 'dark' pada elemen <html>
        document.documentElement.classList.toggle('dark', isDark.value);
        localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    }
};

// [BARU] FUNGSI MENERAPKAN WARNA PRIMER KE CSS GLOBAL
const applyPrimaryColor = (hexColor) => {
    if (process.client) {
        // Menerapkan warna HEX ke variabel CSS kustom
        document.documentElement.style.setProperty('--app-primary-color', "#" + hexColor.replace('#', ''));
        
        // Catatan: Karena PrimeVue/Tailwind menggunakan palet angka (50, 600, dll),
        // pendekatan ini hanya akan mengubah warna pada elemen yang menggunakan variabel
        // --app-primary-color (lihat di base.css) atau mengubah semua palet warna PrimeVue.
        // Untuk demo ini, kita hanya mengubah satu variabel untuk elemen kustom.
    }
}

// Watcher untuk mendeteksi perubahan warna di store
watch(primaryColorSetting, (newColor) => {
    applyPrimaryColor(newColor);
}, { immediate: true }); // [UPDATE] Jalankan segera saat komponen dimuat

onMounted(() => {
    // Inisialisasi tema saat mounting
    if (process.client) {
        const theme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        // Tentukan tema awal: dari localStorage, atau default ke preferensi sistem (jika belum ada di local storage)
        isDark.value = (theme === 'dark' || (!theme && prefersDark));
        document.documentElement.classList.toggle('dark', isDark.value);
    }
});
// ----------------------------------------

// --- MENU STRUCTURE ---
const items = ref([
    { 
        label: 'Dashboard', 
        icon: 'pi pi-home', 
        route: '/',
        key: 'dashboard'
    },
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
            { 
                label: 'Penjualan / Pembelian', 
                icon: 'pi pi-wallet',
                route: '/transaction', 
                command: (event) => {
                    router.push('/transaction');
                }
            },
            {
                label: 'Piutang / Hutang', 
                icon: 'pi pi-money-bill',
                route: '/arap', 
                command: (event) => {
                    router.push('/arap');
                }
            },
            {
                label: 'Jurnal', 
                icon: 'pi pi-book',
                route: '/arap', 
                command: (event) => {
                    router.push('/arap');
                }
            },
        ]
    },
    { 
        label: 'Laporan', 
        icon: 'pi pi-chart-bar', 
        key: 'report',
        items: [
             { 
                label: 'Penjualan / Pembelian', 
                icon: 'pi pi-chart-line', 
                route: '/report/transaction',
                command: (event) => {
                    router.push('/report/transaction');
                }
            },
            { 
                label: 'Piutang / Hutang', 
                icon: 'pi pi-chart-line', 
                route: '/report/arap',
                command: (event) => {
                    router.push('/report/arap');
                }
            },
            { 
                label: 'Produk / Stok', 
                icon: 'pi pi-chart-line', 
                route: '/report/arap',
                command: (event) => {
                    router.push('/report/arap');
                }
            },
            { 
                label: 'Produksi',
                icon: 'pi pi-chart-line', 
                route: '/report/arap',
                command: (event) => {
                    router.push('/report/arap');
                }
            },
        ]
    },
]);

// --- PROFILE MENU ---
const profileMenu = ref();
const profileItems = ref([
    { 
        label: 'Pengaturan', 
        icon: 'pi pi-cog', 
        class: 'text-surface-700 dark:text-surface-200 hover:!bg-surface-50 dark:hover:!bg-surface-800',
        command: () => router.push('/setting')
    },
    { separator: true },
    { 
        label: 'Logout', 
        icon: 'pi pi-sign-out', 
        class: 'text-red-600 hover:!bg-red-50/50 dark:hover:!bg-red-900/30 font-bold', 
        command: async () => await authService.logout()
    }
]);

const toggleProfile = (event) => {
    profileMenu.value.toggle(event);
};

// --- DESKTOP NAVIGATION LOGIC (CLICK TO OPEN) ---
const desktopMenuRef = ref();
const desktopSubItems = ref([]);

const toggleDesktopSubMenu = (event, item) => {
    desktopSubItems.value = item.items.map(sub => ({
        label: sub.label,
        icon: sub.icon,
        command: () => {
            if (sub.route) {
                 router.push(sub.route);
            } else if (sub.command) {
                sub.command();
            }
        },
        separator: sub.separator 
    }));
    // Menggunakan kelas dark:bg-surface-800 pada menu popup desktop
    desktopMenuRef.value.toggle(event);
};

// --- MOBILE NAVIGATION LOGIC ---
const mobileMenuRef = ref();
const mobileSubItems = ref([]); 

const onMobileNavClick = (event, item) => {
    if (item.route && !item.items) {
        router.push(item.route);
    } else if (item.items) {
        mobileSubItems.value = item.items.map(sub => ({
            label: sub.label,
            icon: sub.icon,
            command: () => {
                if (sub.route) {
                    router.push(sub.route);
                } else if (sub.command) {
                    sub.command();
                }
            },
             separator: sub.separator
        }));
        mobileMenuRef.value.toggle(event);
    }
};

// Cek Active Route (untuk highlight parent menu)
const isRouteActive = (item) => {
    if (item.route) return route.path.startsWith(item.route) && item.route !== '/';
    if (item.route === '/' && route.path === '/') return true;
    if (item.items) return item.items.some(sub => sub.route && route.path.startsWith(sub.route));
    return false;
};
</script>

<template>
    <!-- CONTAINER UTAMA: Menggunakan warna Surface yang adaptif -->
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
        
        <!-- HEADER / NAVBAR -->
        <header class="sticky top-0 z-50 shadow-xl dark:shadow-black/50 bg-primary-600 dark:bg-primary-950/90 border-b border-primary-700 dark:border-primary-800 px-2 md:px-4 backdrop-blur-md bg-opacity-95">
            <div class="flex items-center h-16 w-full max-w-screen-2xl mx-auto" :style="`background-color: var(--app-primary-color); border-color: color-mix(in srgb, var(--app-primary-color) 90%, black);`">

                <NuxtLink to="/" class="flex items-center gap-3 group pl-2 shrink-0">
                    <!-- LOGO DINAMIS -->
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden shrink-0">
                        <img 
                            v-if="currentLogoUrl" 
                            :src="currentLogoUrl" 
                            alt="Logo Toko" 
                            class="w-full h-full object-cover" 
                            onerror="this.onerror=null; this.src='https://placehold.co/90x90/FFFFFF/000000?text=R';"
                        />
                        <!-- Fallback jika tidak ada logo atau error -->
                        <div v-else class="w-full h-full bg-white text-primary-600 flex items-center justify-center">R</div>
                    </div>

                    <div class="flex flex-col">
                        <!-- Store Name: Teks putih di Light/Dark mode header -->
                        <span class="text-lg font-bold text-white tracking-tight leading-none group-hover:text-primary-100 transition-colors">
                            {{ storeName }}
                        </span>
                        <!-- POS System Tag: Warna light blue di Light/Dark mode header -->
                        <span class="text-[10px] text-primary-200 font-medium tracking-wide uppercase">
                            POS System
                        </span>
                    </div>
                </NuxtLink>

                <!-- DESKTOP NAVIGATION ITEMS -->
                <div class="hidden md:flex items-center gap-1 ml-8">
                    <template v-for="item in items" :key="item.label">
                        
                        <!-- Item tanpa sub-menu (Dashboard) -->
                        <NuxtLink v-if="item.route && !item.items" :to="item.route" 
                            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            :class="route.path === item.route 
                                ? 'bg-white/20 text-white shadow-inner' 
                                : 'text-primary-100 hover:bg-white/10 hover:text-white'">
                            <i :class="item.icon"></i>
                            <span>{{ item.label }}</span>
                        </NuxtLink>

                        <!-- Item dengan sub-menu (Manajemen, Transaksi, Laporan) -->
                        <button v-else 
                            @click="(e) => toggleDesktopSubMenu(e, item)"
                            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 outline-none focus:ring-2 focus:ring-white/20"
                            :class="isRouteActive(item) 
                                ? 'bg-white/20 text-white shadow-inner' 
                                : 'text-primary-100 hover:bg-white/10 hover:text-white'"
                            aria-haspopup="true">
                            <i :class="item.icon"></i>
                            <span>{{ item.label }}</span>
                            <i class="pi pi-angle-down text-xs opacity-70 ml-0.5"></i>
                        </button>

                    </template>
                </div>

                <div class="flex-1"></div>

                <!-- ACTIONS (DARK MODE & PROFILE) -->
                <div class="flex items-center gap-2 pr-2 shrink-0">
                    
                    <!-- Dark Mode Toggle Button -->
                    <Button 
                        :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" 
                        text 
                        rounded 
                        severity="secondary"
                        class="!w-10 !h-10 text-white hover:bg-white/10" 
                        @click="toggleDarkMode" 
                        v-tooltip.bottom="'Toggle Dark Mode'" 
                    />

                    <!-- Profile Avatar & Menu Trigger -->
                    <div class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        @click="toggleProfile" aria-haspopup="true" aria-controls="profile_menu">
                        
                        <!-- Teks Username -->
                        <span class="hidden md:block text-sm text-white font-medium mr-1">Halo, {{ authStore.user?.username || 'Admin' }}</span>
                        
                        <!-- Avatar -->
                        <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" class="!bg-white dark:!bg-surface-100 !text-primary-600 font-bold border-2 border-primary-400/50 dark:border-primary-700/50" shape="circle" />
                        <i class="pi pi-chevron-down text-primary-100 text-xs hidden sm:block"></i>
                    </div>
                </div>

            </div>
        </header>

        <!-- MAIN CONTENT SLOT -->
        <!-- Class pb-24 untuk memberi ruang bagi nav mobile -->
        <main class="flex-1 container mx-auto p-4 lg:p-6 max-w-screen-2xl w-full animate-fade-in pb-24 md:pb-6">
            <NuxtPage />
        </main>

        <!-- FOOTER (Desktop Only) -->
        <footer class="border-t border-surface-200 dark:border-surface-800 py-6 mt-auto hidden md:block">
            <div class="container mx-auto px-4 text-center text-sm text-surface-500 dark:text-surface-400">
                &copy; 2025 {{ storeName }}. <span class="text-primary-600 dark:text-primary-400 font-bold">Powered by RetailApp</span>.
            </div>
        </footer>

        <!-- MOBILE NAVIGATION (Fixed Bottom) -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 border-t border-surface-200 dark:border-surface-800 z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-black/50">
            <div class="flex justify-around items-center h-16">
                <button v-for="item in items" :key="item.label"
                    @click="(event) => onMobileNavClick(event, item)"
                    class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95"
                    :class="isRouteActive(item) 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'">
                    <div class="relative px-3 py-1 rounded-full" :class="isRouteActive(item) ? 'bg-primary-50 dark:bg-primary-900/30' : ''">
                        <i :class="[item.icon, 'text-xl mb-0.5']"></i>
                        <!-- Dot indikator jika menu punya sub-item dan sedang aktif -->
                        <div v-if="item.items && isRouteActive(item)" class="absolute -top-0 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-surface-900"></div>
                    </div>
                    <span class="text-[10px] font-medium">{{ item.label }}</span>
                </button>
            </div>
        </nav>

        <!-- MENU POPUPS (Pastikan mereka menggunakan style default dari PrimeVue yang sudah di-override di base.css) -->
        <Menu ref="profileMenu" id="profile_menu" :model="profileItems" :popup="true" class="mt-2 w-48" />
        <Menu ref="desktopMenuRef" :model="desktopSubItems" :popup="true" class="mt-2 w-48" />
        <Menu ref="mobileMenuRef" :model="mobileSubItems" :popup="true" class="!w-48 !mb-2" />

    </div>
</template>

<style scoped>
/* Padding bawah untuk menyesuaikan safe area di HP modern */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }

.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>