<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Import Components Baru (Warehouse)
import WarehouseList from '~/components/warehouse/WarehouseList.vue';
import WarehouseCreateModal from '~/components/warehouse/WarehouseCreateModal.vue';

// Gunakan Service Warehouse
const warehouseService = useWarehouseService();
const toast = useToast();

// --- STATE TABS ---
const activeIndex = ref(0); // 0: Manajemen, 1: Kelola Stok, 2: Riwayat

// --- STATE: MANAJEMEN GUDANG ---
const warehouseListRef = ref(null);
const showCreateModal = ref(false);
const formLoading = ref(false);
const selectedWarehouseEdit = ref(null);

// --- STATE: KELOLA STOK & RIWAYAT ---
const allWarehouses = ref([]); // Untuk dropdown pilihan gudang
const selectedWarehouseUuid = ref(null); // Gudang yang sedang dipilih di dropdown
const currentWarehouseData = ref(null); // Data detail stok gudang aktif
const historyList = ref([]); // Data riwayat
const dataLoading = ref(false);

// =================================================================
// 1. INITIAL LOAD
// =================================================================
onMounted(async () => {
    await loadAllWarehousesDropdown();
});

const loadAllWarehousesDropdown = async () => {
    try {
        const res = await warehouseService.getAllWarehouses();
        const data = res?.data?.data || res?.data || res || [];
        allWarehouses.value = data;
        
        // Auto select gudang pertama jika belum ada yang dipilih
        if (!selectedWarehouseUuid.value && allWarehouses.value.length > 0) {
            selectedWarehouseUuid.value = allWarehouses.value[0].uuid;
        }
    } catch (err) {
        console.error("Gagal load dropdown gudang", err);
    }
};

// =================================================================
// 2. WATCHER: Ganti Data saat Gudang Dipilih
// =================================================================
watch(selectedWarehouseUuid, async (newUuid) => {
    if (newUuid) {
        if (activeIndex.value === 1) await loadWarehouseStock(newUuid);
        if (activeIndex.value === 2) await loadHistory(newUuid);
    }
});

// Watch Tab Change
watch(activeIndex, async (newTab) => {
    if (selectedWarehouseUuid.value) {
        if (newTab === 1) await loadWarehouseStock(selectedWarehouseUuid.value);
        if (newTab === 2) await loadHistory(selectedWarehouseUuid.value);
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
    // Pindah ke tab 1 (Kelola Stok) dan set dropdown ke gudang yang diklik
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
        warehouseListRef.value?.fetchWarehouses(); // Refresh list visual di komponen child
        loadAllWarehousesDropdown(); // Refresh data dropdown
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
        // Panggil fungsi getWarehouseStock yang menembak endpoint /:uuid/stock
        const res = await warehouseService.getWarehouseStock(uuid);
        currentWarehouseData.value = res?.data || res;
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat detail stok gudang', life: 3000 });
        currentWarehouseData.value = null; // Kosongkan data agar tidak error
    } finally {
        dataLoading.value = false;
    }
};

// =================================================================
// 5. LOGIC: RIWAYAT
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
    <div class="p-6 min-h-screen bg-surface-0">
        
        <div class="mb-6">
            <h1 class="text-2xl font-bold">Inventory & Gudang</h1>
            <p class="text-surface-500">Pusat manajemen multi-gudang, stok produk, dan pemantauan pergerakan barang.</p>
        </div>

        <TabView v-model:activeIndex="activeIndex" class="shadow-sm rounded-xl bg-surface-0 overflow-hidden border border-surface-200">
            
            <TabPanel>
                <template #header>
                    <div class="flex items-center gap-2 px-2">
                        <i class="pi pi-building"></i>
                        <span class="font-semibold">Manajemen Gudang</span>
                    </div>
                </template>

                <div class="p-2 md:p-4">
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
                    <div class="flex items-center gap-2 px-2">
                        <i class="pi pi-box"></i>
                        <span class="font-semibold">Cek Stok Lokasi</span>
                    </div>
                </template>

                <div class="p-4 space-y-4">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-50 p-4 rounded-lg border border-surface-200">
                        <div class="flex flex-col w-full md:w-auto">
                            <label class="text-xs font-bold text-surface-500 mb-1 uppercase">Pilih Lokasi Gudang/Rak</label>
                            <Dropdown 
                                v-model="selectedWarehouseUuid" 
                                :options="allWarehouses" 
                                optionLabel="name" 
                                optionValue="uuid" 
                                filter
                                placeholder="Pilih Gudang..." 
                                class="w-full md:w-72"
                            >
                                <template #option="slotProps">
                                    <div class="flex items-center gap-2">
                                        <i class="pi pi-map-marker text-primary-500"></i>
                                        <div>
                                            <div class="font-medium">{{ slotProps.option.name }}</div>
                                            <div class="text-xs text-surface-500">{{ slotProps.option.location || '-' }}</div>
                                        </div>
                                    </div>
                                </template>
                            </Dropdown>
                        </div>

                        <div v-if="currentWarehouseData" class="flex gap-4">
                             <div class="text-right border-r pr-4 border-surface-300">
                                <div class="text-xs text-surface-500">Kapasitas Rak</div>
                                <div class="font-bold text-lg text-surface-800">{{ currentWarehouseData.capacity || 'Tidak Terbatas' }}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-surface-500">Item Tersimpan</div>
                                <div class="font-bold text-lg text-primary-600">{{ currentWarehouseData.products?.length || 0 }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="border rounded-xl overflow-hidden shadow-sm">
                         <DataTable :value="currentWarehouseData?.products" :loading="dataLoading" stripedRows paginator :rows="10" class="p-datatable-sm">
                            <template #empty>
                                <div class="p-8 text-center flex flex-col items-center text-surface-400 bg-surface-50/50">
                                    <i class="pi pi-box text-4xl mb-3 opacity-40"></i>
                                    <span v-if="!selectedWarehouseUuid" class="font-medium">Silakan pilih gudang dari menu dropdown di atas.</span>
                                    <span v-else class="font-medium">Gudang ini kosong. Belum ada produk yang dialokasikan ke sini.</span>
                                </div>
                            </template>

                            <Column header="Info Produk" style="min-width: 15rem">
                                <template #body="{ data }">
                                    <div>
                                        <div class="font-bold text-surface-800">{{ data.name }}</div>
                                        <div class="text-[10px] text-surface-500 mt-0.5"><i class="pi pi-barcode mr-1"></i>{{ data.barcode || '-' }}</div>
                                    </div>
                                </template>
                            </Column>
                            
                            <Column header="Kategori">
                                <template #body="{ data }">
                                    <Tag :value="data.category?.name || 'Umum'" severity="secondary" rounded />
                                </template>
                            </Column>

                            <Column header="Satuan Default">
                                <template #body="{ data }">
                                    <span class="text-xs font-medium bg-surface-100 px-2 py-1 rounded">{{ data.unit?.name || 'Unit' }}</span>
                                </template>
                            </Column>

                            <Column header="Stok Total" alignFrozen="right">
                                <template #body="{ data }">
                                    <span class="font-bold text-lg" :class="(data.stock || 0) > 0 ? 'text-emerald-600' : 'text-red-500'">
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
                    <div class="flex items-center gap-2 px-2">
                        <i class="pi pi-history"></i>
                        <span class="font-semibold">Riwayat Mutasi</span>
                    </div>
                </template>

                <div class="p-4 space-y-4">
                     <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-50 p-4 rounded-lg border border-surface-200">
                        <div class="flex flex-col w-full md:w-auto">
                            <label class="text-xs font-bold text-surface-500 mb-1">FILTER LOKASI</label>
                            <Dropdown 
                                v-model="selectedWarehouseUuid" 
                                :options="allWarehouses" 
                                optionLabel="name" 
                                optionValue="uuid" 
                                filter
                                placeholder="Semua Lokasi" 
                                class="w-full md:w-72"
                                showClear
                            />
                        </div>
                        <Button label="Muat Ulang Riwayat" icon="pi pi-refresh" outlined severity="secondary" size="small" @click="loadHistory(selectedWarehouseUuid)" />
                    </div>

                    <div class="border rounded-xl overflow-hidden shadow-sm">
                        <DataTable :value="historyList" :loading="dataLoading" stripedRows paginator :rows="10" class="p-datatable-sm">
                            <template #empty>
                                <div class="p-8 text-center text-surface-400 italic bg-surface-50/50">
                                    <i class="pi pi-folder-open text-3xl mb-2 block opacity-50"></i>
                                    Belum ada riwayat pergerakan stok di gudang ini.
                                </div>
                            </template>
                            
                            <Column field="date" header="Tanggal & Waktu" sortable style="width: 180px">
                                 <template #body="{ data }">
                                    <div class="font-medium">{{ data.date?.split(' ')[0] }}</div>
                                    <div class="text-[10px] text-surface-500">{{ data.date?.split(' ')[1] }}</div>
                                </template>
                            </Column>
                            
                            <Column field="ref" header="No. Jurnal">
                                 <template #body="{ data }">
                                    <span class="font-mono text-xs bg-surface-100 px-2 py-1 rounded text-surface-600 border border-surface-200">{{ data.ref }}</span>
                                </template>
                            </Column>
                            
                            <Column field="product" header="Item"></Column>
                            
                            <Column field="type" header="Aktivitas" sortable style="width: 130px">
                                 <template #body="{ data }">
                                    <Tag :severity="data.type === 'IN' ? 'success' : 'danger'" class="!text-[10px] uppercase">
                                        <div class="flex items-center gap-1">
                                            <i class="pi" :class="data.type === 'IN' ? 'pi-arrow-down-left' : 'pi-arrow-up-right'"></i>
                                            {{ data.type === 'IN' ? 'Masuk' : 'Keluar' }}
                                        </div>
                                    </Tag>
                                </template>
                            </Column>
                            
                            <Column field="qty" header="Kuantitas" class="text-right">
                                 <template #body="{ data }">
                                    <span class="font-black text-base" :class="data.type === 'IN' ? 'text-emerald-600' : 'text-red-600'">
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

        <WarehouseCreateModal 
            :isOpen="showCreateModal"
            :data="selectedWarehouseEdit"
            :loading="formLoading"
            @close="showCreateModal = false"
            @submit="handleFormSubmit"
        />

    </div>
</template>