<script setup>
import { ref, reactive, onMounted, watch } from "vue";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "~/stores/auth.store";

// Import komponen-komponen
import GeneralTab from "~/components/setting/GeneralTab.vue";
import DisplayTab from "~/components/setting/DisplayTab.vue";
import StoreManagementTab from "~/components/setting/StoreManagementTab.vue";
import SalesTab from "~/components/setting/SalesTab.vue";
import PurchaseTab from "~/components/setting/PurchaseTab.vue";
import DeviceTab from "~/components/setting/DeviceTab.vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const activeTab = ref("general");
const loading = ref(false);
const initialLoading = ref(true);

const menuItems = [
  { id: "general", label: "Identitas Toko", icon: "pi pi-building", desc: "Nama, alamat, dan kontak" },
  { id: "display", label: "Tampilan & Tata Letak", icon: "pi pi-palette", desc: "Tema warna dan posisi menu" },
  { id: "stores", label: "Manajemen Toko", icon: "pi pi-sitemap", desc: "Buat dan kelola toko" },
  { id: "sales", label: "Transaksi Penjualan", icon: "pi pi-shopping-cart", desc: "Pajak, struk, dan stok" },
  { id: "purchase", label: "Pembelian (Stok)", icon: "pi pi-truck", desc: "Supplier dan persetujuan" },
  { id: "device", label: "Perangkat & Printer", icon: "pi pi-print", desc: "Konfigurasi hardware" },
];

const settings = reactive({
  // 1. General
  store_name: "", store_phone: "", store_address: "", store_footer_msg: "", store_logo_url: null, 
  
  // Display
  theme_primary_color: "#2563eb", 
  layout_mode: "topbar", // [BARU] Default ke topbar

  // 2. Sales
  sale_tax_enabled: false, sale_tax_percentage: 0, sale_tax_method: "exclusive", sale_allow_negative_stock: false, sale_require_customer: false,
  // 3. Purchase
  buy_require_supplier: true, buy_auto_approve: true, buy_default_due_days: 30,
  // 4. Device
  dev_printer_width: "58mm", dev_auto_print_receipt: true, dev_show_logo_receipt: false,
});

// Routing Logic
const changeTab = (tabId) => {
  activeTab.value = tabId;
  router.push({ query: { ...route.query, tab: tabId } });
};

watch(() => route.query.tab, (newTab) => {
    if (newTab && menuItems.some((item) => item.id === newTab)) {
      activeTab.value = newTab;
    } else {
      activeTab.value = "general";
    }
}, { immediate: true });

// Data Mapping
const updateSettingValue = (key, value) => {
  if (key === "store_logo_url") { settings.store_logo_url = value; return; }
  if (settings.hasOwnProperty(key)) {
    const currentType = typeof settings[key];
    if (currentType === "boolean") settings[key] = String(value) === "true" || String(value) === "1";
    else if (currentType === "number") settings[key] = Number(value) || 0;
    else settings[key] = value;
  }
};

const mapApiToState = (apiSettingsObj) => {
  if (!apiSettingsObj || typeof apiSettingsObj !== "object") return;
  if (Array.isArray(apiSettingsObj)) {
    apiSettingsObj.forEach((item) => updateSettingValue(item.key, item.value));
  } else {
    for (const [key, value] of Object.entries(apiSettingsObj)) updateSettingValue(key, value);
  }
};

const mapStateToPayload = () => {
  const settingsArray = [];
  const profileKeys = ["store_name", "store_phone", "store_address"];
  for (const [key, value] of Object.entries(settings)) {
    if (profileKeys.includes(key)) continue;
    let formattedValue = value;
    if (typeof value === "boolean") formattedValue = value ? "true" : "false";
    if (typeof value === "number") formattedValue = String(value);
    if (value === null || value === undefined) formattedValue = "";
    settingsArray.push({ key, value: formattedValue });
  }
  return settingsArray;
};

// Fetching
const fetchSettings = async () => {
  initialLoading.value = true;
  try {
    await authStore.fetchUserStores();
    const storeData = authStore.activeStore;
    if (storeData) {
      settings.store_name = storeData.name || "";
      settings.store_phone = storeData.phone || "";
      settings.store_address = storeData.address || "";
      if (storeData.settings) {
        settings.store_logo_url = null;
        mapApiToState(storeData.settings);
      }
    }
  } catch (e) {
    toast.add({ severity: "error", summary: "Error", detail: "Gagal memuat pengaturan toko" });
  } finally {
    initialLoading.value = false;
  }
};

const handleReset = () => {
  confirm.require({
    message: "Kembalikan ke pengaturan terakhir disimpan?",
    header: "Konfirmasi Reset",
    icon: "pi pi-refresh",
    acceptClass: "p-button-danger",
    accept: () => fetchSettings(),
  });
};

const saveSettings = async () => {
  loading.value = true;
  try {
    const payload = {
      name: settings.store_name,
      phone: settings.store_phone,
      address: settings.store_address,
      settings: mapStateToPayload(),
    };
    await authStore.saveStoreSettings(payload);
    await authStore.fetchUserStores();
    
    // [BARU] Reload halaman jika mode layout berubah agar efeknya instan dan bersih
    const currentLayout = authStore.getSetting('layout_mode');
    if (currentLayout !== settings.layout_mode && import.meta.client) {
       setTimeout(() => window.location.reload(), 500);
    }

    toast.add({ severity: "success", summary: "Tersimpan", detail: "Pengaturan berhasil diperbarui.", life: 3000 });
  } catch (e) {
    const msg = e.response?._data?.message || e.message || "Terjadi kesalahan saat menyimpan.";
    toast.add({ severity: "error", summary: "Gagal", detail: msg });
  } finally {
    loading.value = false;
  }
};

onMounted(() => fetchSettings());
definePageMeta({ layout: "default" });
</script>

<template>
  <div class="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 md:p-6 animate-fade-in">
    <Toast />
    <ConfirmDialog />

    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Pengaturan Toko</h1>
          <p class="text-surface-500 text-sm mt-1">Kelola profil, toko, preferensi transaksi, dan sistem.</p>
        </div>
        <div class="flex gap-3" v-if="activeTab !== 'stores'">
          <Button label="Reset" icon="pi pi-refresh" severity="secondary" text @click="handleReset" :disabled="loading" />
          <Button label="Simpan Perubahan" icon="pi pi-save" @click="saveSettings" :loading="loading" raised />
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <aside class="w-full lg:w-64 shrink-0 space-y-2">
          <div class="bg-surface-0 dark:bg-surface-400 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm sticky top-24">
            <div class="p-2">
              <button v-for="item in menuItems" :key="item.id" @click="changeTab(item.id)"
                class="w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all duration-200 group relative overflow-hidden"
                :class="activeTab === item.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-bold ring-1 ring-primary-200 dark:ring-primary-800' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900'">
                <div class="mt-0.5" :class="activeTab === item.id ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'"><i :class="item.icon"></i></div>
                <div><div class="text-sm">{{ item.label }}</div><div class="text-[10px] opacity-70 font-normal mt-0.5 leading-tight">{{ item.desc }}</div></div>
                <div v-if="activeTab === item.id" class="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full"></div>
              </button>
            </div>
          </div>
        </aside>

        <main class="flex-1">
          <div v-if="initialLoading" class="flex justify-center py-20"><ProgressSpinner style="width: 50px; height: 50px" /></div>
          
          <div v-else class="space-y-6">
            <GeneralTab v-if="activeTab === 'general'" :settings="settings" :loading="loading" @refresh-store="fetchSettings" />
            <DisplayTab v-if="activeTab === 'display'" :settings="settings" />
            <StoreManagementTab v-if="activeTab === 'stores'" :settings="settings" />
            <SalesTab v-if="activeTab === 'sales'" :settings="settings" />
            <PurchaseTab v-if="activeTab === 'purchase'" :settings="settings" />
            <DeviceTab v-if="activeTab === 'device'" :settings="settings" />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>