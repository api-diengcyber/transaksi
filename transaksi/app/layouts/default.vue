<script setup>
import { ref, computed, onMounted, watch } from 'vue'; 
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth.store';
import { useAuthService } from '~/composables/useAuthService'; 

const config = useRuntimeConfig();
const router = useRouter();
const route = useRoute(); 
const authService = useAuthService();
const authStore = useAuthStore();

// --- STATE ---
const isSwitchingStore = ref(false);
const targetStoreName = ref('');
const expandedSidebarKeys = ref({}); 

// State Sidebar
const isSidebarCollapsed = ref(false);
const toggleSidebarState = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    if (isSidebarCollapsed.value) expandedSidebarKeys.value = {};
};

// [BARU] STATE UNTUK MULTI-WINDOW TABS
const openTabs = ref([]);

// Fungsi Menutup Tab
const closeTab = (index, event) => {
    event.stopPropagation(); // Mencegah navigasi saat klik tombol close
    const tabToRemove = openTabs.value[index];
    
    // Hapus tab
    openTabs.value.splice(index, 1);

    // Jika tab yang ditutup adalah tab aktif, pindah ke tab sebelumnya (atau tab terakhir)
    if (route.path === tabToRemove.route && openTabs.value.length > 0) {
        const lastTab = openTabs.value[openTabs.value.length - 1];
        router.push(lastTab.route);
    } else if (openTabs.value.length === 0) {
        router.push('/'); // Jika semua tab tutup, kembali ke dashboard
    }
};

// Computed Data
const storeName = computed(() => authStore.activeStore?.name || 'RetailApp');
const storeDescription = computed(() => authStore.activeStore?.description || 'POS System');
const primaryColorSetting = computed(() => authStore.getSetting('theme_primary_color', '#2563eb'));

// Default ke topbar. Opsi: 'topbar', 'sidebar', 'tabs', 'multiwindow'
const layoutMode = computed(() => authStore.getSetting('layout_mode', 'topbar'));

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
watch(primaryColorSetting, (newColor) => applyPrimaryColor(newColor), { immediate: true }); 

onMounted(async () => {
    await authStore.fetchUserStores();
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
        icon: 'pi pi-briefcase', // Representasi bisnis/manajemen
        key: 'manajemen',
        items: [
            { label: 'Produk', icon: 'pi pi-box', route: '/product' }, // Box barang
            { label: 'Restaurant', icon: 'pi pi-th-large', route: '/restaurant' }, // Layout meja/grid
            { label: 'Produksi', icon: 'pi pi-cog', route: '/production' }, // Gear/Proses produksi
            { label: 'Stok/Gudang', icon: 'pi pi-database', route: '/inventory' }, // Database stok
            { label: 'Ekspedisi', icon: 'pi pi-truck', route: '/courier' }, // Truk pengiriman
            { label: 'Bank & Rekening', icon: 'pi pi-building-columns', route: '/bank' }, // Gedung bank/Institusi
            { label: 'Member', icon: 'pi pi-user', route: '/member' }, // User personal
            { label: 'Supplier', icon: 'pi pi-address-book', route: '/supplier' }, // Buku alamat rekanan
            { label: 'User/Pegawai', icon: 'pi pi-id-card', route: '/user' }, // Kartu identitas pegawai
        ]
    },
    { 
        label: 'Transaksi', 
        icon: 'pi pi-shopping-cart', // Icon transaksi umum
        key: 'transaksi',
        items: [
            { label: 'Penjualan', icon: 'pi pi-shopping-cart', route: '/sale' }, // Keranjang belanja
            { label: 'Pembelian', icon: 'pi pi-shopping-bag', route: '/buy' }, // Tas belanja (kulakan)
            { label: 'Retur barang', icon: 'pi pi-refresh', route: '/return' }, // Panah putar balik
            { label: 'Piutang', icon: 'pi pi-arrow-circle-down', route: '/ar' }, // Panah masuk (uang masuk)
            { label: 'Hutang', icon: 'pi pi-arrow-circle-up', route: '/ap' }, // Panah keluar (uang keluar)
            // { label: 'Akun', icon: 'pi pi-tags', route: '/account' }, // Tag akun/kategori
            // { label: 'Jurnal', icon: 'pi pi-book', route: '/journal' }, // Buku pembukuan
            { label: 'Keuangan', icon: 'pi pi-book', route: '/financial' }, // Keuangan
        ]
    },
    { 
        label: 'Laporan', 
        icon: 'pi pi-chart-bar', // Grafik batang umum
        key: 'report',
        items: [
             { label: 'Produk / Stok', icon: 'pi pi-file', route: '#' }, // File laporan umum
             { label: 'Produksi', icon: 'pi pi-sliders-h', route: '#' }, // Slider kontrol produksi
             { label: 'Analisa POS', icon: 'pi pi-chart-pie', route: '/report/graph' }, // Diagram lingkaran analisa
             { label: 'Penjualan', icon: 'pi pi-percentage', route: '/report/sale' }, // Persentase profit
             { label: 'Pembelian', icon: 'pi pi-wallet', route: '/report/buy' }, // Dompet pengeluaran
             { label: 'Retur barang', icon: 'pi pi-replay', route: '/report/return' }, // Replay history
             { label: 'Piutang', icon: 'pi pi-file-excel', route: '/report/ar' }, // Data excel/angka
             { label: 'Hutang', icon: 'pi pi-file-pdf', route: '/report/ap' }, // Dokumen tagihan
             { label: 'Keuangan', icon: 'pi pi-file-pdf', route: '/report/financial' }, // Dokumen tagihan
        ]
    },
]);

// --- [BARU] LOGIC DETEKSI TAB AKTIF ---
// Helper untuk mencari label menu berdasarkan route saat ini
const findMenuItem = (path, menuItems) => {
    for (const item of menuItems) {
        if (item.route === path) return item;
        if (item.items) {
            const found = findMenuItem(path, item.items);
            if (found) return found;
        }
    }
    return null;
};

// Watch Route Change untuk menambah Tab secara otomatis
watch(() => route.path, (newPath) => {
    if (layoutMode.value !== 'multiwindow') return;

    const existingTab = openTabs.value.find(tab => tab.route === newPath);
    if (!existingTab) {
        const menuItem = findMenuItem(newPath, items.value);
        // Jika route ada di menu, tambahkan ke tabs. Jika tidak (halaman detail yg tidak ada di menu), pakai nama default
        openTabs.value.push({
            label: menuItem ? menuItem.label : 'Halaman',
            icon: menuItem ? menuItem.icon : 'pi pi-file',
            route: newPath
        });
    }
}, { immediate: true });


// --- STORE SWITCHER ---
const storeMenu = ref();
// layouts/default.vue
const handleSwitchStore = (store) => {
    storeMenu.value.hide();
    
    // Cek agar tidak reload jika toko sama
    if (authStore.activeStore?.uuid === store.uuid) return;

    targetStoreName.value = store.name;
    isSwitchingStore.value = true;
    
    setTimeout(async () => { 
        // Panggil switchStore (yang sudah KITA HAPUS reload-nya)
        await authStore.switchStore(store.uuid); 
        
        if (process.client) {
            // Reload terjadi di sini
            window.location.reload();
        } else {
            isSwitchingStore.value = false;
            router.push('/');
        }
    }, 800);
};

const buildHierarchy = (flatStores) => { 
    const map = {}; const roots = [];
    flatStores.forEach(store => {
        map[store.uuid] = {
            label: store.name,
            icon: store.storeType === 'CABANG' ? 'pi pi-sitemap' : 'pi pi-building',
            uuid: store.uuid, parentId: store.parentId,
            class: authStore.activeStore?.uuid === store.uuid ? 'font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : '',
            command: () => handleSwitchStore(store), items: [] 
        };
    });
    flatStores.forEach(store => {
        const node = map[store.uuid];
        if (store.parentId && map[store.parentId]) map[store.parentId].items.push(node);
        else roots.push(node);
    });
    const processNodes = (nodes) => {
        nodes.forEach(node => {
            if (node.items.length === 0) delete node.items;
            else {
                processNodes(node.items);
                node.items.unshift({ label: 'Ke ' + node.label, icon: 'pi pi-arrow-right', uuid: node.uuid, command: node.command, class: node.class, style: 'font-size: 0.9em' });
                delete node.command;
            }
        });
        return nodes;
    };
    return processNodes(roots);
};

const storeItems = computed(() => {
    const allStores = authStore.flatStores;
    if (!allStores || allStores.length === 0) return [];
    return buildHierarchy(allStores);
});
const toggleStoreMenu = (event) => storeMenu.value.toggle(event);

// --- MENU ACTIONS ---
const profileMenu = ref();
const profileItems = ref([
    { label: 'Pengaturan', icon: 'pi pi-cog', command: () => router.push('/setting') },
    { separator: true },
    { label: 'Logout', icon: 'pi pi-sign-out', class: 'text-red-600 font-bold', command: async () => await authService.logout() }
]);
const toggleProfile = (event) => profileMenu.value.toggle(event);

const desktopMenuRef = ref();
const desktopSubItems = ref([]);
const toggleDesktopSubMenu = (event, item) => {
    desktopSubItems.value = item.items.map(sub => ({ ...sub, command: () => sub.route ? router.push(sub.route) : null }));
    desktopMenuRef.value.toggle(event);
};

const toggleSidebar = (key) => {
    if (isSidebarCollapsed.value) {
        isSidebarCollapsed.value = false;
        setTimeout(() => { expandedSidebarKeys.value[key] = true; }, 150);
    } else {
        expandedSidebarKeys.value[key] = !expandedSidebarKeys.value[key];
    }
};

const mobileMenuRef = ref();
const mobileSubItems = ref([]); 
const onMobileNavClick = (event, item) => {
    if (item.route && !item.items) {
        router.push(item.route);
    } else if (item.items) {
        mobileSubItems.value = item.items.map(sub => ({ ...sub, command: () => sub.route ? router.push(sub.route) : null }));
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
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-100 transition-colors duration-300">
        
        <aside v-if="layoutMode === 'sidebar' || layoutMode === 'multiwindow'" 
               class="hidden lg:flex fixed top-0 left-0 h-screen bg-surface-0 dark:bg-surface-100 flex-col z-50 transition-all duration-300 shadow-xl border-r border-surface-200 dark:border-surface-700"
               :class="isSidebarCollapsed ? 'w-20' : 'w-64'">
            
            <div class="h-16 flex items-center justify-between px-3 border-b border-white/10 shadow-sm shrink-0" 
                 :style="`background-color: var(--app-primary-color);`">
                <NuxtLink to="/" class="flex items-center gap-3 overflow-hidden group transition-all" :class="isSidebarCollapsed ? 'w-full justify-center' : 'w-auto'">
                    <div class="w-9 h-9 rounded-lg bg-surface-0 text-primary-600 flex items-center justify-center font-black text-xl shadow-md shrink-0 transition-transform" 
                         :class="!isSidebarCollapsed ? 'group-hover:scale-105' : ''">
                        <img v-if="currentLogoUrl" :src="currentLogoUrl" alt="Logo" class="w-full h-full object-cover rounded-lg" onerror="this.style.display='none'"/>
                        <span v-else>R</span>
                    </div>
                    <div v-show="!isSidebarCollapsed" class="flex flex-col overflow-hidden text-white transition-opacity duration-300">
                        <span class="font-bold leading-none truncate w-full text-base tracking-tight">{{ storeName }}</span>
                        <span class="text-[10px] text-primary-100 truncate w-full mt-0.5 font-medium opacity-90">{{ storeDescription }}</span>
                    </div>
                </NuxtLink>
                <button v-show="!isSidebarCollapsed" @click="toggleSidebarState" class="text-white/70 hover:text-white transition-colors p-1">
                    <i class="pi pi-align-left"></i>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1.5 scrollbar-thin">
                <div v-if="layoutMode === 'multiwindow' && !isSidebarCollapsed" class="px-2 pb-2 text-xs font-bold text-surface-400 uppercase tracking-widest">
                    Explorer
                </div>

                <button v-if="isSidebarCollapsed" @click="toggleSidebarState" class="w-full mb-4 py-2 flex justify-center text-surface-400 hover:text-primary-600 transition-colors">
                    <i class="pi pi-angle-double-right"></i>
                </button>
                <template v-for="item in items" :key="item.key">
                    <NuxtLink v-if="item.route && !item.items" :to="item.route" 
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative"
                        :class="[route.path === item.route ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 font-bold' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200', isSidebarCollapsed ? 'justify-center' : '']"
                        :title="isSidebarCollapsed ? item.label : ''">
                        <i :class="[item.icon, 'text-lg transition-colors shrink-0', route.path === item.route ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400 dark:text-surface-500 group-hover:text-surface-600']"></i>
                        <span v-show="!isSidebarCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
                        <div v-if="route.path === item.route && layoutMode !== 'multiwindow'" class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full"></div>
                    </NuxtLink>
                    <div v-else>
                        <button @click="toggleSidebar(item.key)" 
                            class="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200"
                            :class="isSidebarCollapsed ? 'justify-center' : 'justify-between'" :title="isSidebarCollapsed ? item.label : ''">
                            <div class="flex items-center gap-3">
                                <i :class="[item.icon, 'text-lg text-surface-400 dark:text-surface-500 group-hover:text-surface-600 transition-colors shrink-0', expandedSidebarKeys[item.key] ? 'text-primary-600 dark:text-primary-400' : '']"></i>
                                <span v-show="!isSidebarCollapsed" class="whitespace-nowrap" :class="expandedSidebarKeys[item.key] ? 'font-bold text-surface-800 dark:text-surface-100' : ''">{{ item.label }}</span>
                            </div>
                            <i v-show="!isSidebarCollapsed" class="pi pi-chevron-down text-[10px] transition-transform duration-300 opacity-60" :class="{'rotate-180': expandedSidebarKeys[item.key]}"></i>
                        </button>
                        <div v-show="expandedSidebarKeys[item.key] && !isSidebarCollapsed" class="pl-3 mt-1 space-y-0.5 overflow-hidden transition-all animate-fade-in-down">
                            <div class="border-l-2 border-surface-100 dark:border-surface-700 ml-2.5 pl-2 py-1 space-y-1">
                                <NuxtLink v-for="sub in item.items" :key="sub.label" :to="sub.route"
                                    class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                                    :class="isRouteActive(sub) ? 'text-primary-700 dark:text-primary-300 font-bold bg-primary-50/50 dark:bg-primary-500/10' : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800'">
                                    <span class="w-1.5 h-1.5 rounded-full transition-colors shrink-0" :class="isRouteActive(sub) ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'"></span>
                                    <span class="whitespace-nowrap">{{ sub.label }}</span>
                                </NuxtLink>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
            <div class="p-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-100">
                <div class="flex items-center gap-3 group cursor-pointer" :class="isSidebarCollapsed ? 'justify-center' : ''" @click="toggleProfile" aria-haspopup="true" aria-controls="profile_menu">
                    <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" class="!bg-surface-0 !text-primary-700 font-bold border border-surface-200 dark:border-surface-700 shadow-sm shrink-0" shape="circle" />
                    <div v-show="!isSidebarCollapsed" class="flex-1 overflow-hidden transition-all duration-300">
                        <div class="text-xs font-bold text-surface-700 dark:text-surface-200 truncate">{{ authStore.user?.username || 'User' }}</div>
                        <div class="text-[10px] text-surface-500 truncate">Klik untuk menu</div>
                    </div>
                    <i v-show="!isSidebarCollapsed" class="pi pi-cog text-surface-400 group-hover:text-primary-500 transition-colors"></i>
                </div>
            </div>
        </aside>

        <div class="flex flex-col min-h-screen transition-all duration-300" 
             :class="{
                'lg:ml-64': (layoutMode === 'sidebar' || layoutMode === 'multiwindow') && !isSidebarCollapsed, 
                'lg:ml-20': (layoutMode === 'sidebar' || layoutMode === 'multiwindow') && isSidebarCollapsed,
                'lg:ml-0': layoutMode === 'topbar' || layoutMode === 'tabs'
             }">
            
            <header v-if="layoutMode === 'topbar'" class="sticky top-0 z-50 shadow-xl dark:shadow-black/50 bg-primary-600 dark:bg-primary-950/90 border-b border-primary-700 dark:border-primary-800 px-2 md:px-4 backdrop-blur-md bg-opacity-95"  :style="`background-color: var(--app-primary-color);`">
                <div class="flex items-center h-16 w-full max-w-screen-2xl mx-auto" :style="`background-color: var(--app-primary-color); border-color: color-mix(in srgb, var(--app-primary-color) 90%, black);`">
                    
                    <NuxtLink to="/" class="flex items-center gap-3 group pl-2 shrink-0">
                        <div class="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden shrink-0 bg-surface-0 text-primary-600">
                            <img v-if="currentLogoUrl" :src="currentLogoUrl" alt="Logo" class="w-full h-full object-cover" onerror="this.style.display='none'"/>
                            <span v-else>R</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-lg font-bold text-white tracking-tight leading-none group-hover:text-primary-100 transition-colors">{{ storeName }}</span>
                            <span class="text-[10px] text-primary-200 font-medium tracking-wide uppercase truncate max-w-[120px]">{{ storeDescription }}</span>
                        </div>
                    </NuxtLink>

                    <div class="hidden lg:flex items-center gap-1 ml-8">
                        <template v-for="item in items" :key="item.label">
                            <NuxtLink v-if="item.route && !item.items" :to="item.route" 
                                class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                :class="route.path === item.route ? 'bg-surface-0 shadow-inner' : 'text-primary-100'">
                                <i :class="item.icon"></i>
                                <span>{{ item.label }}</span>
                            </NuxtLink>
                            <button v-else @click="(e) => toggleDesktopSubMenu(e, item)"
                                class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 outline-none focus:ring-2 focus:ring-white/20"
                                :class="isRouteActive(item) ? 'bg-surface-0 shadow-inner' : 'text-primary-100'">
                                <i :class="item.icon"></i>
                                <span>{{ item.label }}</span>
                                <i class="pi pi-angle-down text-xs opacity-70 ml-0.5"></i>
                            </button>
                        </template>
                    </div>

                    <div class="flex-1"></div>

                    <div class="flex items-center gap-3 pr-2 shrink-0">
                        <div class="hidden sm:block" v-if="authStore.flatStores && authStore.flatStores.length > 1">
                            <button @click="toggleStoreMenu" 
                                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-100 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 text-sm transition-colors border border-surface-200 dark:border-surface-700">
                                <i class="pi pi-building text-primary-600"></i>
                                <span class="font-medium max-w-[150px] truncate">{{ authStore.activeStore?.name }}</span>
                                <i class="pi pi-chevron-down text-xs opacity-70"></i>
                            </button>
                        </div>
                        <Button :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" text rounded severity="tertiary" class="!w-10 !h-10 text-white hover:bg-surface-0" @click="toggleDarkMode" />
                        <div class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-surface-0 rounded-full transition-colors" @click="toggleProfile" aria-haspopup="true" aria-controls="profile_menu">
                            <span class="hidden md:block text-sm text-white hover:text-gray-900 font-medium mr-1">Halo, {{ authStore.user?.username || 'User' }}</span>
                            <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" class="!bg-surface-0 !text-primary-600 font-bold" shape="circle" />
                            <i class="pi pi-chevron-down text-primary-100 text-xs hidden sm:block"></i>
                        </div>
                    </div>
                </div>
            </header>

            <header v-if="layoutMode !== 'topbar'" 
                    class="sticky top-0 z-40 h-16 border-b border-surface-200 dark:border-surface-800 px-4 flex items-center justify-between lg:justify-end" 
                    :class="layoutMode === 'multiwindow' ? 'hidden lg:flex !h-14 !bg-surface-0 dark:!bg-surface-900 border-b shadow-none' : ''"
                    :style="layoutMode !== 'multiwindow' ? `background-color: var(--app-primary-color);` : ''">
                
                <div class="lg:hidden flex items-center gap-2" :class="layoutMode === 'multiwindow' ? 'text-surface-800 dark:text-surface-0' : ''">
                    <span class="font-bold text-lg" :class="layoutMode === 'multiwindow' ? 'text-primary-600' : 'text-white'">{{ storeName }}</span>
                </div>

                <div v-if="layoutMode === 'tabs'" class="hidden lg:flex items-center gap-3 mr-auto pl-2">
                    <div class="w-8 h-8 rounded bg-surface-0 text-primary-600 flex items-center justify-center font-black shadow-sm">
                        <img v-if="currentLogoUrl" :src="currentLogoUrl" alt="Logo" class="w-full h-full object-cover rounded" />
                        <span v-else>R</span>
                    </div>
                    <span class="font-bold text-white text-lg">{{ storeName }}</span>
                </div>

                <div v-if="layoutMode === 'multiwindow'" class="hidden lg:flex items-center mr-auto">
                    <div class="text-sm font-medium text-surface-500 dark:text-surface-400">
                        {{ storeName }} <span class="mx-1">/</span> <span class="text-surface-900 dark:text-surface-0">{{ route.meta.title || route.name || 'Dashboard' }}</span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="hidden sm:block" v-if="authStore.flatStores && authStore.flatStores.length > 1">
                        <button @click="toggleStoreMenu" 
                            class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 text-sm transition-colors border border-surface-200 dark:border-surface-700"
                            :class="layoutMode === 'multiwindow' ? 'bg-surface-0 dark:bg-surface-100 text-surface-700 dark:text-surface-200' : 'bg-surface-100 dark:bg-surface-100 text-surface-700 dark:text-surface-200'">
                            <i class="pi pi-building text-primary-600"></i>
                            <span class="font-medium max-w-[150px] truncate">{{ authStore.activeStore?.name }}</span>
                            <i class="pi pi-chevron-down text-xs opacity-70"></i>
                        </button>
                    </div>
                    
                    <Button :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" text rounded severity="tertiary" 
                            class="!w-10 !h-10 hover:bg-surface-0" 
                            :class="layoutMode === 'multiwindow' ? 'text-surface-600 dark:text-surface-200 hover:!bg-surface-100 dark:hover:!bg-surface-800' : 'text-white'"
                            @click="toggleDarkMode" />
                    
                    <div class="flex items-center gap-2 cursor-pointer p-1.5 rounded-full transition-colors"
                         :class="[
                            layoutMode === 'sidebar' ? 'lg:hidden' : '',
                            layoutMode === 'multiwindow' ? 'hover:bg-surface-100 dark:hover:bg-surface-800' : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                         ]" 
                         @click="toggleProfile" aria-haspopup="true" aria-controls="profile_menu">
                        <Avatar :label="authStore.user?.username?.charAt(0).toUpperCase() || 'U'" 
                                class="font-bold border border-surface-200 dark:border-surface-700" 
                                :class="layoutMode === 'multiwindow' ? 'bg-surface-200 text-surface-700' : 'bg-primary-100 text-primary-700'"
                                shape="circle" />
                    </div>
                </div>
            </header>

            <div v-if="layoutMode === 'multiwindow'" 
                 class="hidden lg:flex w-full h-9 bg-surface-100 dark:bg-surface-100 border-b border-surface-200 dark:border-surface-800 overflow-x-auto items-end px-2 gap-1 scrollbar-hide">
                
                <div v-for="(tab, index) in openTabs" :key="tab.route" 
                     @click="router.push(tab.route)"
                     class="group flex items-center gap-2 px-3 h-8 min-w-[120px] max-w-[200px] text-xs cursor-pointer select-none transition-all rounded-t-md border-t border-x"
                     :class="route.path === tab.route 
                        ? 'bg-surface-0 dark:bg-surface-100 border-surface-200 dark:border-surface-700 border-t-primary-500 text-primary-600 dark:text-primary-300 font-bold shadow-sm relative z-10' 
                        : 'bg-surface-200/50 dark:bg-surface-100 border-transparent text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'">
                    
                    <i :class="[tab.icon, 'text-[10px]']"></i>
                    <span class="truncate flex-1">{{ tab.label }}</span>
                    
                    <span @click="(e) => closeTab(index, e)" 
                          class="p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-300 dark:hover:bg-surface-600 transition-all text-[10px]">
                        <i class="pi pi-times"></i>
                    </span>
                </div>
            </div>

            <main class="flex-1 container mx-auto p-4 lg:p-6 max-w-screen-2xl w-full animate-fade-in md:pb-6"
                  :class="[
                    layoutMode === 'tabs' ? 'pb-24' : 'pb-24',
                    layoutMode === 'multiwindow' ? '!p-0 lg:!p-4 bg-surface-0/50 dark:bg-surface-100/50' : ''
                  ]"> 
                <NuxtPage />
            </main>

            <footer class="border-t border-surface-200 dark:border-surface-800 py-6 mt-auto hidden md:block" :class="layoutMode === 'tabs' ? 'mb-20' : ''">
                <div class="container mx-auto px-4 text-center text-sm text-surface-500">
                    &copy; 2025 {{ storeName }}. <span class="text-primary-600 font-bold">Powered by RetailApp</span>.
                </div>
            </footer>
        </div>

        <nav class="fixed bottom-0 left-0 right-0 border-t border-surface-200 dark:border-surface-800 z-50 bg-surface-0 dark:bg-surface-100 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
             :class="layoutMode === 'tabs' ? 'flex' : 'lg:hidden flex'">
             
            <div class="flex justify-around items-center h-16 w-full" :class="layoutMode === 'tabs' ? 'max-w-screen-xl mx-auto' : ''">
                 <button v-for="item in items" :key="item.label"
                    @click="(event) => onMobileNavClick(event, item)"
                    class="flex flex-col items-center justify-center w-full h-full space-y-1 transition-all group relative"
                    :class="isRouteActive(item) ? 'text-primary-600' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-600/50'">
                    
                    <div class="relative">
                        <i :class="[item.icon, 'text-xl transition-transform group-hover:-translate-y-0.5']"></i>
                        <span v-if="item.items" class="absolute -top-1 -right-2 text-[8px] pi pi-angle-down opacity-70"></span>
                    </div>
                    <span class="text-[10px] font-medium">{{ item.label }}</span>
                    
                    <div v-if="isRouteActive(item)" class="absolute top-0 w-8 h-1 bg-primary-500 rounded-b-full"></div>
                </button>
            </div>
        </nav>

        <Menu ref="storeMenu" :model="storeItems" :popup="true" class="w-64 bg-surface-0 dark:bg-surface-100" />
        <Menu ref="profileMenu" id="profile_menu" :model="profileItems" :popup="true" class="mt-2 w-48 bg-surface-0 dark:bg-surface-100" />
        <Menu ref="desktopMenuRef" :model="desktopSubItems" :popup="true" class="mt-2 w-48 bg-surface-0 dark:bg-surface-100" />
        <Menu ref="mobileMenuRef" :model="mobileSubItems" :popup="true" class="!w-48 !mb-2 bg-surface-0 dark:bg-surface-100" />

        <div v-if="isSwitchingStore" class="fixed inset-0 z-[9999] bg-surface-50/90 dark:bg-surface-100 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
            <div class="relative mb-6">
                <i class="pi pi-spin pi-spinner text-6xl text-primary-600"></i>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="pi pi-building text-xl text-primary-600"></i>
                </div>
            </div>
            <div class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">Mengganti Toko</div>
            <div class="text-surface-600 dark:text-surface-400 text-lg">
                Masuk ke <span class="font-bold text-primary-600">{{ targetStoreName }}</span>...
            </div>
        </div>

    </div>
</template>

<style scoped>
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
.animate-fade-in-down { animation: fadeInDown 0.2s ease-out; }
.scrollbar-thin::-webkit-scrollbar { width: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 4px; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>