<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Import Components
import WarehouseList from '~/components/warehouse/WarehouseList.vue';
import WarehouseCreateModal from '~/components/warehouse/WarehouseCreateModal.vue';

// --- IMPORT SERVICE ---
const warehouseService = useWarehouseService();
const productService = useProductService(); 
const shelveService = useShelveService(); 
const journalService = useJournalService(); // <-- TAMBAHKAN INI
const toast = useToast();

// --- STATE TABS ---
const activeIndex = ref(0); // 0: Manajemen, 1: Kelola Stok, 2: Mutasi Stok, 3: Riwayat

// --- STATE: MANAJEMEN GUDANG ---
const warehouseListRef = ref(null);
const showCreateModal = ref(false);
const formLoading = ref(false);
const selectedWarehouseEdit = ref(null);

// --- STATE: KELOLA STOK & RIWAYAT ---
const allWarehouses = ref([]);
const selectedWarehouseUuid = ref(null);
const currentWarehouseData = ref(null);
const historyList = ref([]);
const dataLoading = ref(false);

// --- STATE: MUTASI MANUAL ---
const showMutationModal = ref(false);
const mutationType = ref('IN'); // 'IN' atau 'OUT'
const productList = ref([]); 
const shelvesList = ref([]); // <-- State untuk menyimpan daftar Rak
const mutationLoading = ref(false);

const mutationForm = ref({
    productUuid: null,
    warehouseUuid: null,
    shelveUuid: null, // <-- Tambahan untuk rak (opsional)
    qty: 1,
    note: ''
});

// =================================================================
// 1. INITIAL LOAD
// =================================================================
onMounted(async () => {
    await loadAllWarehousesDropdown();
    await loadAllProducts(); 
    await loadAllShelves(); // <-- Panggil load rak saat komponen dimuat
});

const loadAllWarehousesDropdown = async () => {
    try {
        const res = await warehouseService.getAllWarehouses();
        const data = res?.data?.data || res?.data || res || [];
        allWarehouses.value = data;
        
        if (!selectedWarehouseUuid.value && allWarehouses.value.length > 0) {
            selectedWarehouseUuid.value = allWarehouses.value[0].uuid;
        }
    } catch (err) {
        console.error("Gagal load dropdown gudang", err);
    }
};

const loadAllProducts = async () => {
    try {
        const res = await productService.getAllProducts(1, 100, ''); 
        productList.value = res?.data || res || [];
    } catch (err) {
        console.error("Gagal load produk untuk form", err);
    }
};

const loadAllShelves = async () => {
    try {
        const res = await shelveService.getAllShelves();
        shelvesList.value = res?.data || res || [];
    } catch (err) {
        console.error("Gagal load rak", err);
    }
};

// =================================================================
// 2. WATCHER
// =================================================================
watch(selectedWarehouseUuid, async (newUuid) => {
    if (newUuid) {
        if (activeIndex.value === 1 || activeIndex.value === 2) await loadWarehouseStock(newUuid);
        if (activeIndex.value === 3) await loadHistory(newUuid);
    }
});

watch(activeIndex, async (newTab) => {
    if (selectedWarehouseUuid.value) {
        if (newTab === 1 || newTab === 2) await loadWarehouseStock(selectedWarehouseUuid.value);
        if (newTab === 3) await loadHistory(selectedWarehouseUuid.value);
    }
});

// =================================================================
// 3. LOGIC: MANAJEMEN GUDANG (CRUD)
// =================================================================
const openCreate = () => {
    selectedWarehouseEdit.value = null;
    showCreateModal.value = true;
};

const openEdit = (warehouse) => {
    selectedWarehouseEdit.value = warehouse;
    showCreateModal.value = true;
};

const handleViewFromList = (warehouse) => {
    selectedWarehouseUuid.value = warehouse.uuid;
    activeIndex.value = 1; 
    toast.add({ severity: 'info', summary: 'Mode Stok', detail: `Membuka stok ${warehouse.name}`, life: 2000 });
};

const handleFormSubmit = async (formData) => {
    formLoading.value = true;
    try {
        if (selectedWarehouseEdit.value) {
            await warehouseService.updateWarehouse(selectedWarehouseEdit.value.uuid, formData);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data gudang diperbarui', life: 3000 });
        } else {
            await warehouseService.createWarehouse(formData);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Gudang baru dibuat', life: 3000 });
        }
        showCreateModal.value = false;
        warehouseListRef.value?.fetchWarehouses(); 
        loadAllWarehousesDropdown(); 
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan sistem', life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

// =================================================================
// 4. LOGIC: KELOLA STOK
// =================================================================
const loadWarehouseStock = async (uuid) => {
    dataLoading.value = true;
    try {
        const res = await warehouseService.getWarehouseStock(uuid);
        currentWarehouseData.value = res?.data || res;
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail stok gudang', life: 3000 });
        currentWarehouseData.value = null; 
    } finally {
        dataLoading.value = false;
    }
};

// =================================================================
// 5. LOGIC: MUTASI STOK
// =================================================================
const openMutationForm = (type) => {
    mutationType.value = type;
    mutationForm.value = {
        productUuid: null,
        warehouseUuid: selectedWarehouseUuid.value || (allWarehouses.value.length > 0 ? allWarehouses.value[0].uuid : null),
        shelveUuid: null, 
        qty: 1,
        note: ''
    };
    showMutationModal.value = true;
};

const submitMutation = async () => {
    if (!mutationForm.value.productUuid || mutationForm.value.qty <= 0 || !mutationForm.value.warehouseUuid) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih produk, gudang, dan masukkan Qty yang valid', life: 3000 });
        return;
    }

    mutationLoading.value = true;
    try {
        const payload = {
            type: mutationType.value,
            product_uuid: mutationForm.value.productUuid,
            warehouse_uuid: mutationForm.value.warehouseUuid,
            shelve_uuid: mutationType.value === 'OUT' ? mutationForm.value.shelveUuid : null,
            qty: mutationForm.value.qty,
            note: mutationForm.value.note
        };
        
        // Panggil endpoint menggunakan service
        await journalService.createStockMutation(payload);

        toast.add({ 
            severity: 'success', 
            summary: mutationType.value === 'IN' ? 'Stok Masuk Berhasil' : 'Stok Keluar Berhasil', 
            detail: 'Data stok telah diperbarui', 
            life: 3000 
        });
        
        showMutationModal.value = false;
        
        // Refresh data di layar
        if (selectedWarehouseUuid.value) {
            await loadWarehouseStock(selectedWarehouseUuid.value);
            await loadHistory(selectedWarehouseUuid.value);
        }
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat memproses mutasi', life: 3000 });
    } finally {
        mutationLoading.value = false;
    }
};

// =================================================================
// 6. LOGIC: RIWAYAT
// =================================================================
const loadHistory = async (uuid) => {
    dataLoading.value = true;
    try {
        const res = await warehouseService.getWarehouseHistory(uuid);
        historyList.value = res?.data || res || [];
    } catch (err) {
        console.error("API history mungkin belum siap:", err);
        historyList.value = [];
    } finally {
        dataLoading.value = false;
    }
};
</script>

<template>
    <div class="flex flex-col gap-6 p-4 md:p-6 min-h-screen bg-surface-50 dark:bg-surface-950">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-surface-900 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 m-0">Inventory & Gudang</h1>
                <p class="text-surface-500 dark:text-surface-400 mt-1 mb-0">Pusat manajemen multi-gudang, stok produk, dan pemantauan pergerakan barang.</p>
            </div>
            <div class="flex items-center gap-3" v-if="activeIndex === 0">
                <Button label="Tambah Gudang" icon="pi pi-plus" @click="openCreate" class="rounded-xl font-medium shadow-sm" />
            </div>
        </div>

        <div class="bg-white dark:bg-surface-900 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden">
            <TabView v-model:activeIndex="activeIndex" class="w-full">
                
                <TabPanel>
                    <template #header>
                        <div class="flex items-center gap-2 px-2 py-1">
                            <i class="pi pi-building text-primary-500"></i>
                            <span class="font-semibold">Daftar Gudang</span>
                        </div>
                    </template>
                    <div class="p-4 md:p-6">
                        <WarehouseList 
                            ref="warehouseListRef"
                            @create="openCreate"
                            @edit="openEdit"
                            @view="handleViewFromList" 
                        />
                    </div>
                </TabPanel>

                <TabPanel>
                    <template #header>
                        <div class="flex items-center gap-2 px-2 py-1">
                            <i class="pi pi-box text-primary-500"></i>
                            <span class="font-semibold">Stok Lokasi</span>
                        </div>
                    </template>

                    <div class="p-4 md:p-6 flex flex-col gap-5">
                        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-50 dark:bg-surface-800 p-5 rounded-xl border border-surface-200 dark:border-surface-700">
                            <div class="flex flex-col w-full lg:w-1/3">
                                <label class="text-xs font-bold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wider">Filter Lokasi Gudang/Rak</label>
                                <Dropdown 
                                    v-model="selectedWarehouseUuid" 
                                    :options="allWarehouses" 
                                    optionLabel="name" 
                                    optionValue="uuid" 
                                    filter
                                    placeholder="Pilih Gudang..." 
                                    class="w-full"
                                >
                                    <template #value="slotProps">
                                        <div v-if="slotProps.value" class="flex items-center gap-2 font-medium">
                                            <i class="pi pi-map-marker text-primary-500"></i>
                                            {{ allWarehouses.find(w => w.uuid === slotProps.value)?.name }}
                                        </div>
                                        <span v-else>{{ slotProps.placeholder }}</span>
                                    </template>
                                    <template #option="slotProps">
                                        <div class="flex items-center gap-3 py-1">
                                            <div class="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-600 flex items-center justify-center">
                                                <i class="pi pi-building text-sm"></i>
                                            </div>
                                            <div>
                                                <div class="font-semibold text-surface-700 dark:text-surface-100">{{ slotProps.option.name }}</div>
                                                <div class="text-xs text-surface-500">{{ slotProps.option.location || 'Lokasi tidak diset' }}</div>
                                            </div>
                                        </div>
                                    </template>
                                </Dropdown>
                            </div>

                            <div v-if="currentWarehouseData" class="flex gap-8 w-full lg:w-auto lg:justify-end">
                                 <div class="text-left lg:text-right border-r border-surface-300 dark:border-surface-600 pr-8">
                                    <div class="text-xs font-medium text-surface-500 mb-1">Kapasitas Maksimal</div>
                                    <div class="font-bold text-2xl text-surface-800 dark:text-surface-100">
                                        {{ currentWarehouseData.capacity || 'Unlimited' }}
                                    </div>
                                </div>
                                <div class="text-left lg:text-right">
                                    <div class="text-xs font-medium text-surface-500 mb-1">Item Tersimpan</div>
                                    <div class="font-bold text-2xl text-primary-600 dark:text-primary-400">
                                        {{ currentWarehouseData.products?.length || 0 }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm">
                             <DataTable 
                                :value="currentWarehouseData?.products" 
                                :loading="dataLoading" 
                                stripedRows 
                                paginator 
                                :rows="10" 
                                :rowsPerPageOptions="[10, 25, 50]"
                                class="p-datatable-sm"
                                responsiveLayout="scroll"
                            >
                                <template #empty>
                                    <div class="flex flex-col items-center justify-center py-16 text-surface-500 dark:text-surface-400 bg-surface-50/50 dark:bg-surface-800/50">
                                        <div class="w-20 h-20 rounded-full bg-white dark:bg-surface-900 shadow-sm border border-surface-100 dark:border-surface-700 flex items-center justify-center mb-4">
                                            <i class="pi pi-box text-3xl text-surface-300 dark:text-surface-600"></i>
                                        </div>
                                        <span v-if="!selectedWarehouseUuid" class="font-medium text-lg text-surface-600 dark:text-surface-200">Silakan pilih gudang di atas</span>
                                        <span v-else class="font-medium text-lg text-surface-600 dark:text-surface-200">Gudang ini masih kosong</span>
                                    </div>
                                </template>

                                <Column header="Informasi Produk" style="min-width: 20rem">
                                    <template #body="{ data }">
                                        <div class="flex items-center gap-3 py-1">
                                            <div class="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-400">
                                                <i class="pi pi-image"></i>
                                            </div>
                                            <div>
                                                <div class="font-bold text-surface-900 dark:text-surface-0">{{ data.name }}</div>
                                                <div class="text-xs text-surface-500 mt-1 flex items-center gap-1">
                                                    <i class="pi pi-barcode text-[10px]"></i>
                                                    <span class="font-mono">{{ data.barcode || 'NO-BARCODE' }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </Column>
                                
                                <Column header="Kategori">
                                    <template #body="{ data }">
                                        <Tag :value="data.category?.name || 'Umum'" severity="secondary" rounded class="font-medium px-3 text-xs" />
                                    </template>
                                </Column>

                                <Column header="Ketersediaan" alignFrozen="right" class="text-right">
                                    <template #body="{ data }">
                                        <div class="flex items-center justify-end gap-2">
                                            <div class="w-2 h-2 rounded-full" :class="(data.stock || 0) > 10 ? 'bg-emerald-500' : ((data.stock || 0) > 0 ? 'bg-orange-500' : 'bg-red-500')"></div>
                                            <span class="font-black text-xl" :class="(data.stock || 0) > 0 ? 'text-surface-900 dark:text-surface-0' : 'text-red-500'">
                                                {{ data.stock || 0 }}
                                            </span>
                                        </div>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </div>
                </TabPanel>

                <TabPanel>
                    <template #header>
                        <div class="flex items-center gap-2 px-2 py-1">
                            <i class="pi pi-sort-alt text-primary-500"></i>
                            <span class="font-semibold">Mutasi & Rekap Stok</span>
                        </div>
                    </template>

                    <div class="p-4 md:p-6 flex flex-col gap-5">
                        
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-50 dark:bg-surface-800 p-5 rounded-xl border border-surface-200 dark:border-surface-700">
                            <div>
                                <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100">Rekapitulasi In/Out</h3>
                                <p class="text-sm text-surface-500">Data akumulasi barang masuk dan keluar di lokasi ini.</p>
                            </div>
                            <div class="flex gap-3 w-full md:w-auto">
                                <Button label="Barang Masuk" icon="pi pi-arrow-down-left" severity="success" class="flex-1 md:flex-none shadow-sm font-bold" @click="openMutationForm('IN')" />
                                <Button label="Barang Keluar" icon="pi pi-arrow-up-right" severity="danger" class="flex-1 md:flex-none shadow-sm font-bold" @click="openMutationForm('OUT')" />
                            </div>
                        </div>

                        <div class="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm">
                             <DataTable 
                                :value="currentWarehouseData?.products" 
                                :loading="dataLoading" 
                                stripedRows 
                                paginator 
                                :rows="10" 
                                :rowsPerPageOptions="[10, 25, 50]"
                                class="p-datatable-sm"
                            >
                                <template #empty>
                                    <div class="p-8 text-center text-surface-500 bg-surface-50/50">
                                        <i class="pi pi-box text-3xl mb-3 opacity-50 block"></i>
                                        Pilih gudang terlebih dahulu atau gudang ini masih kosong.
                                    </div>
                                </template>

                                <Column header="Informasi Produk" style="min-width: 15rem">
                                    <template #body="{ data }">
                                        <div class="font-bold text-surface-800 dark:text-surface-100">{{ data.name }}</div>
                                        <div class="text-[10px] text-surface-500 mt-0.5">{{ data.barcode || '-' }}</div>
                                    </template>
                                </Column>
                                
                                <Column header="Total Masuk (IN)" class="text-center">
                                    <template #body="{ data }">
                                        <span class="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">
                                            + {{ data.total_in || 0 }}
                                        </span>
                                    </template>
                                </Column>

                                <Column header="Total Keluar (OUT)" class="text-center">
                                    <template #body="{ data }">
                                        <span class="font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-1 rounded-lg">
                                            - {{ data.total_out || 0 }}
                                        </span>
                                    </template>
                                </Column>

                                <Column header="Sisa (TOTAL)" alignFrozen="right" class="text-right">
                                    <template #body="{ data }">
                                        <span class="font-black text-xl text-surface-900 dark:text-surface-0">
                                            {{ data.stock || 0 }}
                                        </span>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>

                    </div>
                </TabPanel>

                <TabPanel>
                     <template #header>
                        <div class="flex items-center gap-2 px-2 py-1">
                            <i class="pi pi-history text-primary-500"></i>
                            <span class="font-semibold">Log Riwayat</span>
                        </div>
                    </template>

                    <div class="p-4 md:p-6 flex flex-col gap-5">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-50 dark:bg-surface-800 p-5 rounded-xl border border-surface-200 dark:border-surface-700">
                            <div class="flex flex-col w-full md:w-1/3">
                                <label class="text-xs font-bold text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wider">Lokasi Gudang</label>
                                <Dropdown 
                                    v-model="selectedWarehouseUuid" 
                                    :options="allWarehouses" 
                                    optionLabel="name" 
                                    optionValue="uuid" 
                                    filter
                                    placeholder="Semua Lokasi" 
                                    class="w-full"
                                    showClear
                                />
                            </div>
                            <Button label="Refresh Log" icon="pi pi-sync" outlined severity="secondary" @click="loadHistory(selectedWarehouseUuid)" />
                        </div>

                        <div class="border border-surface-200 dark:border-surface-700 rounded-xl overflow-hidden shadow-sm">
                            <DataTable :value="historyList" :loading="dataLoading" stripedRows paginator :rows="15" class="p-datatable-sm">
                                <template #empty>
                                    <div class="p-10 text-center text-surface-500 bg-surface-50/50">
                                        <i class="pi pi-folder-open text-3xl mb-3 opacity-50 block"></i>
                                        Belum ada log pergerakan transaksi di gudang ini.
                                    </div>
                                </template>
                                
                                <Column field="date" header="Waktu" sortable>
                                     <template #body="{ data }">
                                        <div class="font-semibold">{{ data.date?.split(' ')[0] }}</div>
                                        <div class="text-[11px] text-surface-500">{{ data.date?.split(' ')[1] }}</div>
                                    </template>
                                </Column>
                                <Column field="ref" header="Referensi">
                                     <template #body="{ data }">
                                        <span class="font-mono text-xs font-semibold bg-surface-100 px-2 py-1 rounded text-surface-700 border">{{ data.ref }}</span>
                                    </template>
                                </Column>
                                <Column field="product" header="Item"></Column>
                                <Column field="type" header="Aktivitas" sortable>
                                     <template #body="{ data }">
                                        <Tag :severity="data.type === 'IN' ? 'success' : 'danger'" class="px-2 py-1 font-bold text-[10px]" rounded>
                                            <i class="pi text-[10px] mr-1" :class="data.type === 'IN' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'"></i>
                                            {{ data.type === 'IN' ? 'MASUK' : 'KELUAR' }}
                                        </Tag>
                                    </template>
                                </Column>
                                <Column field="qty" header="Stok" class="text-right">
                                     <template #body="{ data }">
                                        <span class="font-black text-lg" :class="data.type === 'IN' ? 'text-emerald-600' : 'text-red-600'">
                                            {{ data.type === 'IN' ? '+' : '-' }}{{ data.qty }}
                                        </span>
                                    </template>
                                </Column>
                                <Column field="user" header="Operator"></Column>
                            </DataTable>
                        </div>
                    </div>
                </TabPanel>

            </TabView>
        </div>

        <WarehouseCreateModal 
            :isOpen="showCreateModal"
            :data="selectedWarehouseEdit"
            :loading="formLoading"
            @close="showCreateModal = false"
            @submit="handleFormSubmit"
        />

        <Dialog v-model:visible="showMutationModal" modal :header="mutationType === 'IN' ? 'Input Barang Masuk' : 'Input Barang Keluar'" :style="{ width: '35rem' }">
            
            <div class="p-2 mb-4 rounded-lg flex items-center justify-center gap-2 border-2" :class="mutationType === 'IN' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'">
                <i class="pi text-xl" :class="mutationType === 'IN' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'"></i>
                <span class="font-bold uppercase tracking-wider">{{ mutationType === 'IN' ? 'Penambahan Stok Masuk' : 'Pengurangan Stok Keluar' }}</span>
            </div>

            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Produk / Item</label>
                    <Dropdown 
                        v-model="mutationForm.productUuid" 
                        :options="productList" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        filter
                        placeholder="Cari Produk..." 
                        class="w-full"
                    >
                        <template #option="slotProps">
                            <div class="flex flex-col">
                                <span class="font-semibold">{{ slotProps.option.name }}</span>
                                <span class="text-[10px] text-surface-500">{{ slotProps.option.barcode || 'No-Barcode' }}</span>
                            </div>
                        </template>
                    </Dropdown>
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Lokasi Gudang</label>
                    <Dropdown 
                        v-model="mutationForm.warehouseUuid" 
                        :options="allWarehouses" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Pilih Gudang..." 
                        class="w-full"
                    />
                </div>

                <div v-if="mutationType === 'OUT'" class="flex flex-col gap-1">
                    <label class="text-sm font-semibold text-surface-600">Pilih Rak <span class="text-xs font-normal text-surface-400">(Opsional)</span></label>
                    <Dropdown 
                        v-model="mutationForm.shelveUuid" 
                        :options="shelvesList" 
                        optionLabel="name" 
                        optionValue="uuid" 
                        placeholder="Pilih Rak (Jika ada)..." 
                        class="w-full"
                        showClear
                    />
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Kuantitas (Qty)</label>
                    <InputNumber v-model="mutationForm.qty" inputId="qty" showButtons :min="1" class="w-full" />
                </div>

                <div class="flex flex-col gap-1">
                    <label class="text-sm font-semibold">Keterangan / Alasan</label>
                    <Textarea v-model="mutationForm.note" rows="3" placeholder="Contoh: Barang retur, Stok opname, dll..." class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="showMutationModal = false" />
                <Button :label="mutationType === 'IN' ? 'Simpan Pemasukan' : 'Simpan Pengeluaran'" icon="pi pi-check" :severity="mutationType === 'IN' ? 'success' : 'danger'" :loading="mutationLoading" @click="submitMutation" />
            </template>
        </Dialog>

    </div>
</template>