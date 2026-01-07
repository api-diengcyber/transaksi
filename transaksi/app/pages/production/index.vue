<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Components
import ProductionModal from '~/components/production/ProductionModal.vue';
import ProductionDetail from '~/components/production/ProductionDetail.vue';

definePageMeta({ layout: 'default' });

const productionService = useProductionService();
const userService = useUserService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const productionOrders = ref([]);
const userList = ref([]); 
const loading = ref(true);

const activeTabIndex = ref(0);
const showProductionModal = ref(false);
const editingOrder = ref(null);

// --- ACTIONS: INITIAL DATA ---

const loadInitialData = async () => {
    loading.value = true;
    try {
        // Load User untuk dishare ke semua tab
        const users = await userService.getAllUsers();
        userList.value = users || [];

        // Load Productions
        const orders = await productionService.getAllOrders();
        productionOrders.value = (orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data awal' });
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS: PRODUCTION CRUD (HEADER) ---

const openCreateModal = () => {
    editingOrder.value = null;
    showProductionModal.value = true;
};

const openEditModal = (order) => {
    editingOrder.value = { ...order };
    showProductionModal.value = true;
};

const handleOrderSubmitted = () => {
    showProductionModal.value = false;
    loadInitialData();
    activeTabIndex.value = 0; // Reset ke tab pertama (terbaru)
};

const confirmDeleteProduction = (order) => {
    // Implementasi delete production jika diperlukan
    toast.add({ severity: 'info', summary: 'Info', detail: 'Fitur hapus order belum tersedia.' });
};

onMounted(() => {
    loadInitialData();
});
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 p-4">
        <Toast />
        <ConfirmDialog />

        <div class="flex items-center justify-between mb-4">
            <div>
                <h1 class="text-2xl font-black  tracking-tight">Produksi</h1>
                <p class="text-surface-500 text-sm">Input data hasil produksi pegawai per langkah.</p>
            </div>
            <div class="flex gap-2">
                <Button label="Buat Produksi Baru" icon="pi pi-plus" severity="primary" @click="openCreateModal" />
                <Button icon="pi pi-refresh" severity="secondary" rounded text @click="loadInitialData" />
            </div>
        </div>

        <div class="flex-1 overflow-hidden rounded-xl border border-surface-200  bg-surface-0 shadow-sm">
            
            <div v-if="loading && productionOrders.length === 0" class="p-8 flex justify-center">
                <ProgressSpinner />
            </div>

            <div v-else-if="productionOrders.length === 0" class="p-12 text-center text-surface-500">
                <i class="pi pi-box text-5xl mb-4 opacity-50"></i>
                <p>Belum ada data produksi. Silakan buat baru.</p>
            </div>

            <TabView v-else v-model:activeIndex="activeTabIndex" scrollable class="h-full flex flex-col" lazy>
                <TabPanel v-for="order in productionOrders" :key="order.uuid" :header="order.name">
                    
                    <ProductionDetail 
                        :production="order"
                        :user-list="userList"
                        @edit-production="openEditModal"
                        @delete-production="confirmDeleteProduction"
                    />

                </TabPanel>
            </TabView>
        </div>

        <ProductionModal 
            v-model:visible="showProductionModal"
            :initial-order="editingOrder"
            @order-submitted="handleOrderSubmitted"
        />

    </div>
</template>