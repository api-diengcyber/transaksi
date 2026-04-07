<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';

import WarehouseList from '~/components/warehouse/WarehouseList.vue';
import WarehouseCreateModal from '~/components/warehouse/WarehouseCreateModal.vue';

// Import Komponen Tab yang dipisah
import InventoryStockTab from '~/components/inventory/InventoryStockTab.vue';
import InventoryMutationTab from '~/components/inventory/InventoryMutationTab.vue';
import InventoryHistoryTab from '~/components/inventory/InventoryHistoryTab.vue';
import InventoryOpnameTab from '~/components/inventory/InventoryOpnameTab.vue';

const warehouseService = useWarehouseService();
const productService = useProductService(); 
const shelveService = useShelveService(); 
const userService = useUserService(); 
const toast = useToast();

const activeIndex = ref(0); 

// Global Master Data
const allWarehouses = ref([]);
const productList = ref([]); 
const shelvesList = ref([]); 
const userList = ref([]); 

// Global Selected Target
const selectedWarehouseUuid = ref(null); 

// State Modal Gudang
const warehouseListRef = ref(null);
const showCreateModal = ref(false);
const formLoading = ref(false);
const selectedWarehouseEdit = ref(null);

// =================================================================
// INITIAL LOAD (Dipisah agar jika satu API error, yang lain tetap jalan)
// =================================================================
onMounted(async () => {
    await loadAllWarehousesDropdown();
    await loadAllProducts(); 
    await loadAllShelves(); 
    await loadAllUsers(); 
});

const loadAllWarehousesDropdown = async () => {
    try {
        const res = await warehouseService.getAllWarehouses();
        allWarehouses.value = res?.data?.data || res?.data || res || [];
        
        // Pilih gudang pertama secara otomatis jika data tersedia
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
        console.error("Gagal load produk", err);
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

const loadAllUsers = async () => {
    try {
        const res = await userService.fetchUsers();
        userList.value = res?.data || res || [];
    } catch (err) {
        console.error("Gagal load user", err);
    }
};

// =================================================================
// HANDLERS
// =================================================================
const openCreate = () => { selectedWarehouseEdit.value = null; showCreateModal.value = true; };
const openEdit = (warehouse) => { selectedWarehouseEdit.value = warehouse; showCreateModal.value = true; };
const handleViewFromList = (warehouse) => { selectedWarehouseUuid.value = warehouse.uuid; activeIndex.value = 1; };

const handleFormSubmit = async (formData) => {
    formLoading.value = true;
    try {
        if (selectedWarehouseEdit.value) await warehouseService.updateWarehouse(selectedWarehouseEdit.value.uuid, formData);
        else await warehouseService.createWarehouse(formData);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data gudang tersimpan', life: 3000 });
        showCreateModal.value = false;
        warehouseListRef.value?.fetchWarehouses(); 
        await loadAllWarehousesDropdown();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan', life: 3000 });
    } finally {
        formLoading.value = false;
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
                    <template #header><div class="flex items-center gap-2"><i class="pi pi-building text-primary-500"></i><span class="font-semibold">Daftar Gudang</span></div></template>
                    <WarehouseList ref="warehouseListRef" @create="openCreate" @edit="openEdit" @view="handleViewFromList" />
                </TabPanel>

                <TabPanel>
                    <template #header><div class="flex items-center gap-2"><i class="pi pi-box text-primary-500"></i><span class="font-semibold">Stok Lokasi</span></div></template>
                    <InventoryStockTab 
                        v-if="activeIndex === 1" 
                        v-model="selectedWarehouseUuid" 
                        :warehouses="allWarehouses" 
                    />
                </TabPanel>

                <TabPanel>
                    <template #header><div class="flex items-center gap-2"><i class="pi pi-sort-alt text-primary-500"></i><span class="font-semibold">Mutasi Manual</span></div></template>
                    <InventoryMutationTab 
                        v-if="activeIndex === 2" 
                        v-model="selectedWarehouseUuid" 
                        :warehouses="allWarehouses" 
                        :users="userList" 
                        :products="productList" 
                        :shelves="shelvesList" 
                    />
                </TabPanel>

                <TabPanel>
                     <template #header><div class="flex items-center gap-2"><i class="pi pi-history text-primary-500"></i><span class="font-semibold">Log Riwayat</span></div></template>
                     <InventoryHistoryTab 
                        v-if="activeIndex === 3" 
                        v-model="selectedWarehouseUuid" 
                        :warehouses="allWarehouses" 
                    />
                </TabPanel>

                <TabPanel>
                    <template #header><div class="flex items-center gap-2"><i class="pi pi-clipboard text-primary-500"></i><span class="font-semibold">Stok Opname</span></div></template>
                    <InventoryOpnameTab 
                        v-if="activeIndex === 4" 
                        v-model="selectedWarehouseUuid" 
                        :warehouses="allWarehouses" 
                        :users="userList" 
                    />
                </TabPanel>

            </TabView>
        </div>

        <WarehouseCreateModal :isOpen="showCreateModal" :data="selectedWarehouseEdit" :loading="formLoading" @close="showCreateModal = false" @submit="handleFormSubmit" />
    </div>
</template>