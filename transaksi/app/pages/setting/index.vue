<script setup>
import { ref, reactive, onMounted, computed, watch, isRef } from "vue";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "~/stores/auth.store";
import { useStoreService } from "~/composables/useStoreService";

// Import komponen TreeTable PrimeVue (biasanya auto-import di Nuxt, tapi jika tidak bisa di uncomment)
// import TreeTable from 'primevue/treetable';
// import Column from 'primevue/column';

// Init Router & Route untuk manipulasi URL
const router = useRouter();
const route = useRoute();

const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const storeService = useStoreService();

// --- STATE UI ---
const activeTab = ref("general");
const loading = ref(false);
const initialLoading = ref(true);
const logoLoading = ref(false);

// State untuk Create Store (Toko Utama Baru)
const isCreateStoreModalOpen = ref(false);
const createLoading = ref(false);
const formStore = ref({
  name: "",
  address: "",
  phone: "",
  email: "",
});

// [BARU] State untuk Branch Tree (Cabang Dinamis)
const isBranchModalOpen = ref(false);
const branchLoading = ref(false);
const branchTreeNodes = ref([]); // Data untuk TreeTable
const selectedParentBranch = ref(null); // Node parent yang dipilih saat klik "Add Sub-Branch"

const formBranch = ref({
  parentStoreUuid: null, // null = root (di bawah active store), terisi = sub-branch
  name: "",
  address: "",
  phone: "",
  // Data Admin Cabang
  username: "",
  email: "",
  password: "",
});

const menuItems = [
  {
    id: "general",
    label: "Identitas Toko",
    icon: "pi pi-building",
    desc: "Nama, alamat, dan kontak",
  },
  {
    id: "display",
    label: "Tampilan & Warna",
    icon: "pi pi-palette",
    desc: "Warna utama aplikasi",
  },
  {
    id: "stores",
    label: "Manajemen Toko",
    icon: "pi pi-sitemap",
    desc: "Buat dan kelola toko",
  },
  {
    id: "sales",
    label: "Transaksi Penjualan",
    icon: "pi pi-shopping-cart",
    desc: "Pajak, struk, dan stok",
  },
  {
    id: "purchase",
    label: "Pembelian (Stok)",
    icon: "pi pi-truck",
    desc: "Supplier dan persetujuan",
  },
  {
    id: "device",
    label: "Perangkat & Printer",
    icon: "pi pi-print",
    desc: "Konfigurasi hardware",
  },
];

const settings = reactive({
  // 1. General
  store_name: "",
  store_phone: "",
  store_address: "",
  store_footer_msg: "",
  store_logo_url: null,
  theme_primary_color: "#2563eb",

  // 2. Sales
  sale_tax_enabled: false,
  sale_tax_percentage: 0,
  sale_tax_method: "exclusive",
  sale_allow_negative_stock: false,
  sale_require_customer: false,

  // 3. Purchase
  buy_require_supplier: true,
  buy_auto_approve: true,
  buy_default_due_days: 30,

  // 4. Device
  dev_printer_width: "58mm",
  dev_auto_print_receipt: true,
  dev_show_logo_receipt: false,
});

// Computed untuk Logo
const currentLogoUrl = computed(() => {
  const urlPath = settings.store_logo_url;
  const fallback = "https://placehold.co/150x150/e0f2f1/047857?text=Logo+Store";

  if (!urlPath) return fallback;

  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBase.replace("/api", "");
  return urlPath.startsWith("http") ? urlPath : `${baseUrl}${urlPath}`;
});

// Fungsi untuk ganti tab dan update URL
const changeTab = (tabId) => {
  activeTab.value = tabId;
  router.push({ query: { ...route.query, tab: tabId } });
};

// Watcher untuk mendeteksi perubahan URL
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && menuItems.some((item) => item.id === newTab)) {
      activeTab.value = newTab;
    } else {
      activeTab.value = "general";
    }
  },
  { immediate: true }
);

// --- LOGIC MAPPER ---
const mapApiToState = (apiSettingsObj) => {
  if (!apiSettingsObj || typeof apiSettingsObj !== "object") return;

  if (Array.isArray(apiSettingsObj)) {
    apiSettingsObj.forEach((item) => {
      updateSettingValue(item.key, item.value);
    });
  } else {
    for (const [key, value] of Object.entries(apiSettingsObj)) {
      updateSettingValue(key, value);
    }
  }
};

const updateSettingValue = (key, value) => {
  if (key === "store_logo_url") {
    settings.store_logo_url = value;
    return;
  }

  if (settings.hasOwnProperty(key)) {
    const currentType = typeof settings[key];
    if (currentType === "boolean") {
      settings[key] = String(value) === "true" || String(value) === "1";
    } else if (currentType === "number") {
      settings[key] = Number(value) || 0;
    } else {
      settings[key] = value;
    }
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

// --- HELPER: Map Branches to PrimeVue TreeNode ---
const mapToTreeNodes = (branches) => {
  if (!branches || !Array.isArray(branches)) return [];

  return branches.map((branch) => ({
    key: branch.uuid,
    data: {
      uuid: branch.uuid,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      type: "Cabang",
    },
    // Rekursif: jika branch punya branches lagi, map juga
    children:
      branch.branches && branch.branches.length > 0
        ? mapToTreeNodes(branch.branches)
        : [],
  }));
};

// --- FETCHING ---
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
    console.error(e);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal memuat pengaturan toko",
    });
  } finally {
    initialLoading.value = false;
  }
};

// Fetch Tree Data Cabang
const fetchBranches = async () => {
  try {
    // Panggil endpoint tree (/store/branch-tree) via service
    const data = await storeService.getBranches();
    const rawData = isRef(data) ? data.value : data || [];

    // Map ke format PrimeVue TreeTable
    branchTreeNodes.value = mapToTreeNodes(rawData);
  } catch (e) {
    console.error("Gagal ambil data cabang", e);
  }
};

// Watch activeTab -> jika masuk tab 'stores', load data cabang
watch(activeTab, (newTab) => {
  if (newTab === "stores") {
    fetchBranches();
  }
});

// --- ACTIONS SETTINGS ---
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

    toast.add({
      severity: "success",
      summary: "Tersimpan",
      detail: "Pengaturan berhasil diperbarui.",
      life: 3000,
    });
  } catch (e) {
    console.error(e);
    const msg =
      e.response?._data?.message ||
      e.message ||
      "Terjadi kesalahan saat menyimpan.";
    toast.add({ severity: "error", summary: "Gagal", detail: msg });
  } finally {
    loading.value = false;
  }
};

const onLogoUpload = async (event) => {
  const file = event.files ? event.files[0] : null;
  if (!file) return;

  logoLoading.value = true;
  try {
    const response = await storeService.uploadStoreLogo(file);
    if (response.logoUrl) {
      settings.store_logo_url = response.logoUrl;
    }
    await authStore.fetchUserStores();
    toast.add({
      severity: "success",
      summary: "Upload Sukses",
      detail: `Logo berhasil diunggah!`,
      life: 3000,
    });
  } catch (e) {
    console.error(e);
    toast.add({
      severity: "error",
      summary: "Gagal Upload",
      detail: e.message || "Gagal mengunggah file.",
      life: 5000,
    });
  } finally {
    logoLoading.value = false;
    event.target.value = "";
  }
};

const onRemoveLogo = () => {
  confirm.require({
    message: "Hapus logo toko saat ini?",
    header: "Hapus Logo",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => {
      settings.store_logo_url = null;
      saveSettings();
    },
  });
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

// --- ACTIONS CREATE STORE (TOKO UTAMA) ---
const resetCreateForm = () => {
  formStore.value = { name: "", address: "", phone: "", email: "" };
};

const handleCreateStore = async () => {
  if (!formStore.value.name || !formStore.value.address) {
    toast.add({
      severity: "warn",
      summary: "Validasi",
      detail: "Nama dan Alamat wajib diisi",
      life: 3000,
    });
    return;
  }

  createLoading.value = true;
  try {
    await storeService.createStore(formStore.value);

    toast.add({
      severity: "success",
      summary: "Sukses",
      detail: "Toko baru berhasil dibuat!",
      life: 3000,
    });

    await authStore.fetchUserStores();

    isCreateStoreModalOpen.value = false;
    resetCreateForm();
  } catch (error) {
    console.error(error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal membuat toko.",
      life: 3000,
    });
  } finally {
    createLoading.value = false;
  }
};

// --- ACTIONS CREATE BRANCH (CABANG DINAMIS) ---
const openBranchModal = (parentNode = null) => {
  // Reset Form
  formBranch.value = {
    parentStoreUuid: null,
    name: "",
    address: "",
    phone: "",
    username: "",
    email: "",
    password: "",
  };

  if (parentNode) {
    // Jika membuka dari tombol (+) di baris tabel, artinya ini SUB-CABANG
    selectedParentBranch.value = parentNode.data;
    formBranch.value.parentStoreUuid = parentNode.data.uuid;
  } else {
    // Jika dari tombol utama "Tambah Cabang", artinya CABANG UTAMA (level 1)
    // Parent = null (nanti di backend di-assign ke Active Store)
    selectedParentBranch.value = null;
  }

  isBranchModalOpen.value = true;
};

const handleCreateBranch = async () => {
  // Validasi sederhana
  if (
    !formBranch.value.name ||
    !formBranch.value.address ||
    !formBranch.value.username ||
    !formBranch.value.password
  ) {
    toast.add({
      severity: "warn",
      summary: "Validasi",
      detail: "Mohon lengkapi data toko dan data admin.",
      life: 3000,
    });
    return;
  }

  branchLoading.value = true;
  try {
    await storeService.createBranch(formBranch.value);

    toast.add({
      severity: "success",
      summary: "Sukses",
      detail: "Cabang berhasil dibuat!",
      life: 3000,
    });

    isBranchModalOpen.value = false;
    await fetchBranches(); // Refresh Tree Structure
  } catch (error) {
    console.error(error);
    const msg = error.response?._data?.message || "Gagal membuat cabang.";
    toast.add({ severity: "error", summary: "Error", detail: msg, life: 3000 });
  } finally {
    branchLoading.value = false;
  }
};

onMounted(() => {
  fetchSettings();
});

definePageMeta({ layout: "default" });
</script>

<template>
  <div
    class="min-h-screen bg-surface-50 dark:bg-surface-950 p-4 md:p-6 animate-fade-in"
  >
    <Toast />
    <ConfirmDialog />

    <div class="max-w-6xl mx-auto">
      <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4"
      >
        <div>
          <h1
            class="text-2xl font-black text-surface-900 dark:text-surface-0 tracking-tight"
          >
            Pengaturan Toko
          </h1>
          <p class="text-surface-500 text-sm mt-1">
            Kelola profil, toko, preferensi transaksi, dan sistem.
          </p>
        </div>
        <div class="flex gap-3">
          <Button
            label="Reset"
            icon="pi pi-refresh"
            severity="secondary"
            text
            @click="handleReset"
            :disabled="loading"
          />
          <Button
            label="Simpan Perubahan"
            icon="pi pi-save"
            @click="saveSettings"
            :loading="loading"
            raised
          />
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <aside class="w-full lg:w-64 shrink-0 space-y-2">
          <div
            class="light:bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm sticky top-24"
          >
            <div class="p-2">
              <button
                v-for="item in menuItems"
                :key="item.id"
                @click="changeTab(item.id)"
                class="w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all duration-200 group relative overflow-hidden"
                :class="
                  activeTab === item.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-bold ring-1 ring-primary-200 dark:ring-primary-800'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 hover:text-surface-900'
                "
              >
                <div
                  class="mt-0.5"
                  :class="
                    activeTab === item.id
                      ? 'text-primary-600'
                      : 'text-surface-400 group-hover:text-surface-600'
                  "
                >
                  <i :class="item.icon"></i>
                </div>
                <div>
                  <div class="text-sm">{{ item.label }}</div>
                  <div
                    class="text-[10px] opacity-70 font-normal mt-0.5 leading-tight"
                  >
                    {{ item.desc }}
                  </div>
                </div>
                <div
                  v-if="activeTab === item.id"
                  class="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full"
                ></div>
              </button>
            </div>
          </div>
        </aside>

        <main class="flex-1">
          <div v-if="initialLoading" class="flex justify-center py-20">
            <ProgressSpinner style="width: 50px; height: 50px" />
          </div>

          <div v-else class="space-y-6">
            <div
              v-if="activeTab === 'general'"
              class="animate-fade-in space-y-6"
            >
              <div class="card-section">
                <h3 class="section-title">Logo Toko</h3>
                <div
                  class="flex flex-col sm:flex-row items-center sm:items-start gap-6"
                >
                  <div class="shrink-0 relative">
                    <img
                      :src="currentLogoUrl"
                      alt="Store Logo"
                      class="w-24 h-24 object-cover rounded-full shadow-md border-4 border-surface-0 dark:border-surface-900"
                    />
                    <div
                      v-if="logoLoading"
                      class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
                    >
                      <ProgressSpinner
                        style="width: 30px; height: 30px"
                        strokeWidth="6"
                        animationDuration=".5s"
                        class="text-white"
                      />
                    </div>
                  </div>

                  <div class="flex flex-col items-center sm:items-start">
                    <p
                      class="text-sm text-surface-600 dark:text-surface-400 mb-3"
                    >
                      Unggah logo baru (Max 1MB, format: JPG/PNG).
                    </p>

                    <div class="flex gap-2">
                      <FileUpload
                        mode="basic"
                        name="file"
                        accept="image/*"
                        :maxFileSize="1000000"
                        @uploader="onLogoUpload"
                        customUpload
                        chooseLabel="Unggah Logo"
                        :auto="true"
                        :disabled="logoLoading || loading"
                        class="!p-0"
                      >
                        <template
                          #choosebutton="{ chooseCallback, label, icon }"
                        >
                          <Button
                            :label="label"
                            :icon="icon"
                            @click="chooseCallback"
                            size="small"
                            :severity="logoLoading ? 'secondary' : 'primary'"
                            :disabled="logoLoading || loading"
                          />
                        </template>
                      </FileUpload>

                      <Button
                        v-if="settings.store_logo_url"
                        label="Hapus"
                        icon="pi pi-trash"
                        severity="danger"
                        size="small"
                        @click="onRemoveLogo"
                        :disabled="loading"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="card-section">
                <h3 class="section-title">Identitas Utama</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="field">
                    <label>Nama Toko</label>
                    <InputText
                      v-model="settings.store_name"
                      class="w-full"
                      placeholder="Contoh: Toko Makmur Jaya"
                    />
                  </div>
                  <div class="field">
                    <label>No. Telepon</label>
                    <InputText
                      v-model="settings.store_phone"
                      class="w-full"
                      placeholder="0812..."
                    />
                  </div>
                  <div class="field md:col-span-2">
                    <label>Alamat Lengkap</label>
                    <Textarea
                      v-model="settings.store_address"
                      rows="3"
                      class="w-full"
                    />
                  </div>
                  <div class="field md:col-span-2">
                    <label>Pesan Kaki (Footer Note Struk)</label>
                    <InputText
                      v-model="settings.store_footer_msg"
                      class="w-full"
                      placeholder="Contoh: Terimakasih telah berbelanja!"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else-if="activeTab === 'stores'"
              class="animate-fade-in space-y-6"
            >
              <div
                class="flex justify-between items-center bg-primary-50 dark:bg-primary-900/10 p-4 rounded-xl border border-primary-100 dark:border-primary-800"
              >
                <div>
                  <h3
                    class="text-lg font-bold text-primary-800 dark:text-primary-100"
                  >
                    Manajemen Toko & Cabang
                  </h3>
                  <p class="text-sm text-primary-600 dark:text-primary-300">
                    Kelola toko utama dan struktur hierarki cabang Anda.
                  </p>
                </div>
                <div class="flex gap-2">
                  <Button
                    label="Buat Toko Baru"
                    icon="pi pi-plus"
                    outlined
                    @click="isCreateStoreModalOpen = true"
                  />
                  <Button
                    label="Tambah Cabang Utama"
                    icon="pi pi-sitemap"
                    @click="openBranchModal(null)"
                  />
                </div>
              </div>

              <h4 class="font-bold text-surface-700 dark:text-surface-200 mt-4">
                Daftar Akses Toko Anda
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  v-for="store in authStore.stores"
                  :key="store.uuid"
                  class="p-5 rounded-xl border transition-all cursor-pointer relative group bg-white dark:bg-surface-900 shadow-sm hover:shadow-md"
                  :class="
                    store.uuid === authStore.activeStore?.uuid
                      ? 'border-primary-500 ring-1 ring-primary-500'
                      : 'border-surface-200 dark:border-surface-700 hover:border-primary-400'
                  "
                  @click="authStore.switchStore(store.uuid)"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-primary-600 font-bold text-lg"
                      >
                        {{ store.name.charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <h4
                          class="font-bold text-surface-900 dark:text-surface-100"
                        >
                          {{ store.name }}
                        </h4>
                        <p class="text-xs text-surface-500">
                          {{ store.phone || "-" }}
                        </p>
                      </div>
                    </div>
                    <Tag
                      v-if="store.uuid === authStore.activeStore?.uuid"
                      value="Aktif"
                      severity="success"
                      class="text-xs"
                    />
                  </div>
                  <p
                    class="mt-3 text-sm text-surface-600 dark:text-surface-400 line-clamp-2 min-h-[2.5rem]"
                  >
                    {{ store.address || "Belum ada alamat" }}
                  </p>
                  <div
                    class="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800 flex justify-end"
                  >
                    <span class="text-xs text-primary-600 group-hover:underline"
                      >Ganti ke Toko Ini &rarr;</span
                    >
                  </div>
                </div>
              </div>

              <div
                class="mt-8 pt-6 border-t border-surface-200 dark:border-surface-700"
              >
                <h4
                  class="font-bold text-surface-700 dark:text-surface-200 mb-4 flex items-center gap-2"
                >
                  <i class="pi pi-sitemap"></i> Struktur Cabang:
                  {{ settings.store_name }}
                </h4>

                <div
                  v-if="branchTreeNodes.length === 0"
                  class="text-center py-8 bg-surface-50 dark:bg-surface-800 rounded-xl border border-dashed border-surface-300 dark:border-surface-700"
                >
                  <p class="text-surface-500">
                    Belum ada struktur cabang untuk toko ini.
                  </p>
                  <Button
                    label="Buat Cabang Pertama"
                    link
                    @click="openBranchModal(null)"
                  />
                </div>

                <div
                  v-else
                  class="card border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden bg-white dark:bg-surface-900"
                >
                  <TreeTable
                    :value="branchTreeNodes"
                    :autoLayout="true"
                    class="text-sm"
                  >
                    <Column field="name" header="Nama Cabang" :expander="true">
                      <template #body="slotProps">
                        <span class="font-bold">{{
                          slotProps.node.data.name
                        }}</span>
                      </template>
                    </Column>
                    <Column field="address" header="Alamat"></Column>
                    <Column field="phone" header="Telepon"></Column>
                    <Column
                      header="Aksi"
                      style="width: 10rem; text-align: right"
                    >
                      <template #body="slotProps">
                        <Button
                          icon="pi pi-plus"
                          size="small"
                          text
                          rounded
                          severity="secondary"
                          v-tooltip.top="'Tambah Sub-Cabang di sini'"
                          @click="openBranchModal(slotProps.node)"
                        />
                      </template>
                    </Column>
                  </TreeTable>
                </div>
              </div>
            </div>

            <div
              v-else-if="activeTab === 'display'"
              class="animate-fade-in space-y-6"
            >
              <div class="card-section">
                <h3 class="section-title">Warna Utama Aplikasi</h3>
                <div class="field">
                  <label>Pilih Warna Utama (Hex Code)</label>
                  <div class="flex gap-4 items-center">
                    <ColorPicker
                      v-model="settings.theme_primary_color"
                      format="hex"
                      class="!w-10 !h-10"
                    />
                    <InputText
                      v-model="settings.theme_primary_color"
                      placeholder="#2563eb"
                      class="w-40 !py-2.5 !text-sm font-mono"
                    />
                  </div>
                  <small class="text-surface-500 mt-2 block">
                    *Catatan: Perubahan warna memerlukan refresh halaman untuk
                    efek penuh.
                  </small>
                </div>
              </div>
            </div>

            <div v-if="activeTab === 'sales'" class="animate-fade-in space-y-6">
              <div class="card-section">
                <div class="flex justify-between items-start mb-4">
                  <div>
                    <h3 class="section-title !mb-0">Pajak Penjualan (PPN)</h3>
                    <p class="text-xs text-surface-500 mt-1">
                      Atur pajak pertambahan nilai otomatis.
                    </p>
                  </div>
                  <InputSwitch v-model="settings.sale_tax_enabled" />
                </div>

                <div
                  v-if="settings.sale_tax_enabled"
                  class="bg-surface-50 dark:bg-surface-800 p-4 rounded-xl border border-surface-200 dark:border-surface-700 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                >
                  <div class="field">
                    <label>Persentase Pajak (%)</label>
                    <InputNumber
                      v-model="settings.sale_tax_percentage"
                      suffix="%"
                      :min="0"
                      :max="100"
                      showButtons
                      class="w-full"
                    />
                  </div>
                  <div class="field">
                    <label>Metode Perhitungan</label>
                    <SelectButton
                      v-model="settings.sale_tax_method"
                      :options="[
                        { label: 'Exclude', value: 'exclusive' },
                        { label: 'Include', value: 'inclusive' },
                      ]"
                      optionLabel="label"
                      optionValue="value"
                      class="w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              <div class="card-section">
                <h3 class="section-title">Kebijakan Stok & Pelanggan</h3>
                <div class="space-y-4">
                  <div
                    class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors"
                  >
                    <div>
                      <div
                        class="font-bold text-sm text-surface-800 dark:text-surface-100"
                      >
                        Izinkan Stok Minus
                      </div>
                      <div class="text-xs text-surface-500">
                        Kasir tetap bisa input barang meski stok 0.
                      </div>
                    </div>
                    <InputSwitch v-model="settings.sale_allow_negative_stock" />
                  </div>
                  <div
                    class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors"
                  >
                    <div>
                      <div
                        class="font-bold text-sm text-surface-800 dark:text-surface-100"
                      >
                        Wajib Pilih Pelanggan
                      </div>
                      <div class="text-xs text-surface-500">
                        Transaksi tidak bisa diproses tanpa data pelanggan.
                      </div>
                    </div>
                    <InputSwitch v-model="settings.sale_require_customer" />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="activeTab === 'purchase'"
              class="animate-fade-in space-y-6"
            >
              <div class="card-section">
                <h3 class="section-title">Konfigurasi Pembelian</h3>
                <div class="grid grid-cols-1 gap-4">
                  <div
                    class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
                  >
                    <div>
                      <div class="font-bold text-sm">Wajib Isi Supplier</div>
                      <div class="text-xs text-surface-500">
                        Mencegah input stok masuk tanpa asal-usul.
                      </div>
                    </div>
                    <InputSwitch v-model="settings.buy_require_supplier" />
                  </div>

                  <div
                    class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
                  >
                    <div>
                      <div class="font-bold text-sm">Otomatis Approve</div>
                      <div class="text-xs text-surface-500">
                        Stok langsung bertambah tanpa perlu persetujuan.
                      </div>
                    </div>
                    <InputSwitch v-model="settings.buy_auto_approve" />
                  </div>

                  <div class="field mt-2">
                    <label>Jatuh Tempo Default (Hari)</label>
                    <InputNumber
                      v-model="settings.buy_default_due_days"
                      suffix=" Hari"
                      class="w-full md:w-1/2"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="activeTab === 'device'"
              class="animate-fade-in space-y-6"
            >
              <div class="card-section">
                <h3 class="section-title">Pengaturan Printer Struk</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="field">
                    <label>Ukuran Kertas</label>
                    <div class="flex gap-4 mt-1">
                      <div class="flex align-items-center">
                        <RadioButton
                          v-model="settings.dev_printer_width"
                          inputId="p58"
                          name="paper"
                          value="58mm"
                        />
                        <label for="p58" class="ml-2 text-sm">58mm</label>
                      </div>
                      <div class="flex align-items-center">
                        <RadioButton
                          v-model="settings.dev_printer_width"
                          inputId="p80"
                          name="paper"
                          value="80mm"
                        />
                        <label for="p80" class="ml-2 text-sm">80mm</label>
                      </div>
                    </div>
                  </div>
                  <div class="field">
                    <label>Opsi Cetak</label>
                    <div class="flex flex-col gap-2 mt-1">
                      <div class="flex align-items-center">
                        <Checkbox
                          v-model="settings.dev_auto_print_receipt"
                          binary
                          inputId="autoprint"
                        />
                        <label for="autoprint" class="ml-2 text-sm"
                          >Otomatis Print</label
                        >
                      </div>
                      <div class="flex align-items-center">
                        <Checkbox
                          v-model="settings.dev_show_logo_receipt"
                          binary
                          inputId="showlogo"
                        />
                        <label for="showlogo" class="ml-2 text-sm"
                          >Tampilkan Logo</label
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>

    <Dialog
      v-model:visible="isCreateStoreModalOpen"
      modal
      header="Buat Toko Baru"
      :style="{ width: '500px' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 mt-2">
        <div class="flex flex-col gap-2">
          <label for="store_name" class="font-semibold text-sm"
            >Nama Toko <span class="text-red-500">*</span></label
          >
          <InputText
            id="store_name"
            v-model="formStore.name"
            placeholder="Contoh: Toko Jakarta Pusat"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label for="store_address" class="font-semibold text-sm"
            >Alamat <span class="text-red-500">*</span></label
          >
          <Textarea
            id="store_address"
            v-model="formStore.address"
            rows="3"
            placeholder="Alamat lengkap..."
            class="w-full"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label for="store_phone" class="font-semibold text-sm"
              >No. Telepon</label
            >
            <InputText
              id="store_phone"
              v-model="formStore.phone"
              placeholder="08..."
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label for="store_email" class="font-semibold text-sm">Email</label>
            <InputText
              id="store_email"
              v-model="formStore.email"
              placeholder="email@toko.com"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Batal"
          icon="pi pi-times"
          text
          @click="isCreateStoreModalOpen = false"
          severity="secondary"
        />
        <Button
          label="Simpan Toko"
          icon="pi pi-check"
          @click="handleCreateStore"
          :loading="createLoading"
          severity="primary"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="isBranchModalOpen"
      modal
      :header="
        selectedParentBranch ? `Tambah Sub-Cabang` : 'Tambah Cabang Utama'
      "
      :style="{ width: '600px' }"
      :draggable="false"
    >
      <div class="grid grid-cols-1 gap-6 mt-2">
        <div
          class="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg flex items-center gap-3 border border-primary-100 dark:border-primary-800"
        >
          <i class="pi pi-info-circle text-primary-600 text-xl"></i>
          <div class="text-sm text-surface-700 dark:text-surface-200">
            <span v-if="selectedParentBranch">
              Cabang baru ini akan menjadi bawahan dari
              <strong>{{ selectedParentBranch.name }}</strong
              >.
            </span>
            <span v-else>
              Cabang ini akan berada langsung di bawah toko utama (<strong>{{
                settings.store_name
              }}</strong
              >).
            </span>
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-bold text-primary-600 uppercase tracking-wider border-b pb-1"
          >
            Informasi Cabang
          </div>
          <div class="flex flex-col gap-2">
            <label class="font-semibold text-sm"
              >Nama Cabang <span class="text-red-500">*</span></label
            >
            <InputText
              v-model="formBranch.name"
              placeholder="Contoh: Cabang Surabaya Selatan"
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="font-semibold text-sm"
              >Alamat Cabang <span class="text-red-500">*</span></label
            >
            <Textarea v-model="formBranch.address" rows="2" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="font-semibold text-sm">Telepon</label>
            <InputText v-model="formBranch.phone" class="w-full" />
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-bold text-primary-600 uppercase tracking-wider border-b pb-1"
          >
            Akun Admin Cabang
          </div>
          <div
            class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 mb-2"
          >
            User ini akan memiliki akses penuh (Role Admin) hanya untuk cabang
            yang dibuat ini.
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-sm"
                >Username <span class="text-red-500">*</span></label
              >
              <InputText
                v-model="formBranch.username"
                placeholder="user_cabang"
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="font-semibold text-sm"
                >Email <span class="text-red-500">*</span></label
              >
              <InputText
                v-model="formBranch.email"
                placeholder="email@cabang.com"
                class="w-full"
              />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="font-semibold text-sm"
              >Password <span class="text-red-500">*</span></label
            >
            <Password
              v-model="formBranch.password"
              :feedback="false"
              toggleMask
              class="w-full"
              inputClass="w-full"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Batal"
          icon="pi pi-times"
          text
          @click="isBranchModalOpen = false"
          severity="secondary"
        />
        <Button
          label="Buat Cabang"
          icon="pi pi-check"
          @click="handleCreateBranch"
          :loading="branchLoading"
          severity="primary"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.card-section {
  @apply dark:bg-surface-900 bg-white rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6;
}

.section-title {
  @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-4 pb-2 border-b border-surface-100 dark:border-surface-700;
}

.field label {
  @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>