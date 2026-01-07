<script setup>
import { ref, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Import Components
import ShelveList from '~/components/shelve/ShelveList.vue';
import ShelveCreateModal from '~/components/shelve/ShelveCreateModal.vue';

const shelveService = useShelveService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE TABS ---
const activeIndex = ref(0); // 0: Manajemen, 1: Kelola Stok, 2: Riwayat

// --- STATE: MANAJEMEN GUDANG ---
const shelveListRef = ref(null);
const showCreateModal = ref(false);
const formLoading = ref(false);
const selectedShelveEdit = ref(null);

// --- STATE: KELOLA STOK & RIWAYAT ---
const allShelves = ref([]); // Untuk dropdown pilihan gudang
const selectedShelfUuid = ref(null); // Gudang yang sedang dipilih di dropdown
const currentShelfData = ref(null); // Data detail stok gudang aktif
const historyList = ref([]); // Data riwayat
const dataLoading = ref(false);

// =================================================================
// 1. INITIAL LOAD
// =================================================================
onMounted(async () => {
    await loadAllShelvesDropdown();
});

const loadAllShelvesDropdown = async () => {
    try {
        const data = await shelveService.getAllShelves();
        allShelves.value = data || [];
        
        // Auto select gudang pertama jika belum ada yang dipilih
        if (!selectedShelfUuid.value && allShelves.value.length > 0) {
            selectedShelfUuid.value = allShelves.value[0].uuid;
        }
    } catch (err) {
        console.error("Gagal load dropdown gudang", err);
    }
};

// =================================================================
// 2. WATCHER: Ganti Data saat Gudang Dipilih
// =================================================================
watch(selectedShelfUuid, async (newUuid) => {
    if (newUuid) {
        // Jika Tab Stok aktif, load stok
        if (activeIndex.value === 1) await loadShelfStock(newUuid);
        // Jika Tab Riwayat aktif, load riwayat
        if (activeIndex.value === 2) await loadHistory(newUuid);
    }
});

// Watch Tab Change
watch(activeIndex, async (newTab) => {
    if (selectedShelfUuid.value) {
        if (newTab === 1) await loadShelfStock(selectedShelfUuid.value);
        if (newTab === 2) await loadHistory(selectedShelfUuid.value);
    }
});

// =================================================================
// 3. LOGIC: MANAJEMEN GUDANG (CRUD)
// =================================================================
const openCreate = () => {
    selectedShelveEdit.value = null;
    showCreateModal.value = true;
};

const openEdit = (shelf) => {
    selectedShelveEdit.value = shelf;
    showCreateModal.value = true;
};

const handleViewFromList = (shelf) => {
    // Fitur Pintar: Klik card di Tab 1 -> Pindah ke Tab 2 & Load Datanya
    selectedShelfUuid.value = shelf.uuid;
    activeIndex.value = 1; // Pindah tab
    toast.add({ severity: 'info', summary: 'Mode Stok', detail: `Membuka stok ${shelf.name}`, life: 2000 });
};

const handleFormSubmit = async (formData) => {
    formLoading.value = true;
    try {
        if (selectedShelveEdit.value) {
            await shelveService.updateShelve(selectedShelveEdit.value.uuid, formData);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data gudang diperbarui', life: 3000 });
        } else {
            await shelveService.createShelve(formData);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Gudang baru dibuat', life: 3000 });
        }
        showCreateModal.value = false;
        shelveListRef.value?.refresh(); // Refresh list visual
        loadAllShelvesDropdown(); // Refresh dropdown
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan sistem', life: 3000 });
    } finally {
        formLoading.value = false;
    }
};

// =================================================================
// 4. LOGIC: KELOLA STOK
// =================================================================
const loadShelfStock = async (uuid) => {
    dataLoading.value = true;
    try {
        const data = await shelveService.getShelve(uuid);
        currentShelfData.value = data;
    } catch (err) {
        console.error(err);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat stok', life: 3000 });
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
        const logs = await shelveService.getShelveHistory(uuid);
        historyList.value = logs || [];
    } catch (err) {
        console.error(err);
    } finally {
        dataLoading.value = false;
    }
};

</script>

<template>
    <div class="p-6 min-h-screen bg-surface-0">
        
        <div class="mb-6">
            <h1 class="text-2xl font-bold">Inventory & Stok</h1>
            <p class="text-surface-500">Pusat kendali gudang, stok produk, dan mutasi barang.</p>
        </div>

        <TabView v-model:activeIndex="activeIndex" class="shadow-sm rounded-xl bg-surface-0 overflow-hidden border border-surface-200 ">
            
            <TabPanel>
                <template #header>
                    <div class="flex items-center gap-2">
                        <i class="pi pi-building"></i>
                        <span>Manajemen Gudang</span>
                    </div>
                </template>

                <div class="p-4">
                    <ShelveList 
                        ref="shelveListRef"
                        @create="openCreate"
                        @edit="openEdit"
                        @view="handleViewFromList" 
                    />
                </div>
            </TabPanel>

            <TabPanel>
                <template #header>
                    <div class="flex items-center gap-2">
                        <i class="pi pi-box"></i>
                        <span>Kelola Stok</span>
                    </div>
                </template>

                <div class="p-4 space-y-4">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-50  p-4 rounded-lg border border-surface-200 ">
                        <div class="flex flex-col w-full md:w-auto">
                            <label class="text-xs font-bold text-surface-500 mb-1 uppercase">Pilih Lokasi Gudang/Rak</label>
                            <Dropdown 
                                v-model="selectedShelfUuid" 
                                :options="allShelves" 
                                optionLabel="name" 
                                optionValue="uuid" 
                                filter
                                placeholder="Pilih Gudang..." 
                                class="w-full md:w-72"
                            >
                                <template #option="slotProps">
                                    <div class="flex items-center gap-2">
                                        <i class="pi" :class="slotProps.option.type === 'WAREHOUSE' ? 'pi-building text-blue-500' : 'pi-th-large text-emerald-500'"></i>
                                        <div>
                                            <div class="font-medium">{{ slotProps.option.name }}</div>
                                            <div class="text-xs text-surface-500">{{ slotProps.option.type === 'WAREHOUSE' ? 'Gudang' : 'Rak Display' }}</div>
                                        </div>
                                    </div>
                                </template>
                            </Dropdown>
                        </div>

                        <div v-if="currentShelfData" class="flex gap-4">
                             <div class="text-right">
                                <div class="text-xs text-surface-500">Kapasitas</div>
                                <div class="font-bold text-lg">{{ currentShelfData.capacity || '∞' }}</div>
                            </div>
                            <div class="text-right border-l pl-4 border-surface-300">
                                <div class="text-xs text-surface-500">Total Item</div>
                                <div class="font-bold text-lg text-primary-600">{{ currentShelfData.productShelves?.length || 0 }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="border rounded-lg overflow-hidden">
                         <DataTable :value="currentShelfData?.productShelves" :loading="dataLoading" stripedRows paginator :rows="10">
                            <template #empty>
                                <div class="p-8 text-center flex flex-col items-center text-surface-400">
                                    <i class="pi pi-box text-4xl mb-2 opacity-30"></i>
                                    <span v-if="!selectedShelfUuid">Silakan pilih gudang terlebih dahulu.</span>
                                    <span v-else>Gudang ini kosong.</span>
                                </div>
                            </template>

                            <Column header="Produk">
                                <template #body="slotProps">
                                    <div class="font-bold ">{{ slotProps.data.product?.name }}</div>
                                    <div class="text-xs text-surface-500">{{ slotProps.data.product?.sku || '-' }}</div>
                                </template>
                            </Column>
                            <Column header="Kategori" field="product.category.name"></Column>
                            <Column header="Satuan" field="unit.unitName"></Column>
                            <Column header="Stok Tersedia" field="qty" sortable class="text-right">
                                <template #body="slotProps">
                                    <span class="font-bold text-lg" :class="slotProps.data.qty > 0 ? 'text-emerald-600' : 'text-red-500'">
                                        {{ slotProps.data.qty }}
                                    </span>
                                </template>
                            </Column>
                            <Column header="Aksi" class="text-center w-24">
                                <template #body>
                                    <Button icon="pi pi-ellipsis-v" text rounded size="small" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>
            </TabPanel>

            <TabPanel>
                 <template #header>
                    <div class="flex items-center gap-2">
                        <i class="pi pi-history"></i>
                        <span>Riwayat Stok</span>
                    </div>
                </template>

                <div class="p-4 space-y-4">
                     <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex flex-col w-full md:w-auto">
                            <label class="text-xs font-bold text-surface-500 mb-1">FILTER LOKASI</label>
                            <Dropdown 
                                v-model="selectedShelfUuid" 
                                :options="allShelves" 
                                optionLabel="name" 
                                optionValue="uuid" 
                                filter
                                placeholder="Pilih Lokasi..." 
                                class="w-full md:w-72"
                            />
                        </div>
                        <Button label="Refresh Data" icon="pi pi-refresh" text @click="loadHistory(selectedShelfUuid)" :disabled="!selectedShelfUuid" />
                    </div>

                    <DataTable :value="historyList" :loading="dataLoading" stripedRows paginator :rows="10" class="border rounded-lg overflow-hidden">
                        <template #empty>
                            <div class="p-8 text-center text-surface-400 italic">
                                Belum ada riwayat transaksi untuk lokasi ini.
                            </div>
                        </template>
                        <Column field="date" header="Waktu Transaksi" sortable style="width: 200px">
                             <template #body="slotProps">
                                <div class="font-medium">{{ slotProps.data.date?.split(' ')[0] }}</div>
                                <div class="text-xs text-surface-500">{{ slotProps.data.date?.split(' ')[1] }}</div>
                            </template>
                        </Column>
                        <Column field="ref" header="No. Referensi">
                             <template #body="slotProps">
                                <span class="font-mono text-xs bg-surface-100 px-2 py-1 rounded">{{ slotProps.data.ref }}</span>
                            </template>
                        </Column>
                        <Column field="product" header="Produk"></Column>
                        <Column field="type" header="Tipe" sortable style="width: 120px">
                             <template #body="slotProps">
                                <Tag :severity="slotProps.data.type === 'IN' ? 'success' : 'danger'">
                                    <div class="flex items-center gap-1">
                                        <i class="pi" :class="slotProps.data.type === 'IN' ? 'pi-arrow-down' : 'pi-arrow-up'"></i>
                                        {{ slotProps.data.type === 'IN' ? 'MASUK' : 'KELUAR' }}
                                    </div>
                                </Tag>
                            </template>
                        </Column>
                        <Column field="qty" header="Jumlah" class="text-right font-bold">
                             <template #body="slotProps">
                                <span :class="slotProps.data.type === 'IN' ? 'text-green-600' : 'text-red-600'">
                                    {{ slotProps.data.type === 'IN' ? '+' : '-' }}{{ slotProps.data.qty }}
                                </span>
                            </template>
                        </Column>
                        <Column field="user" header="Admin/User"></Column>
                    </DataTable>
                </div>
            </TabPanel>

        </TabView>

        <ShelveCreateModal 
            :isOpen="showCreateModal"
            :data="selectedShelveEdit"
            :loading="formLoading"
            @close="showCreateModal = false"
            @submit="handleFormSubmit"
        />

    </div>
</template>