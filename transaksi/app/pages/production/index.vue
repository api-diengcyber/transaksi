<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';

// Import komponen modal untuk membuat/mengedit order produksi
import ProductionModal from '~/components/ProductionModal.vue'; 

definePageMeta({ layout: 'default' });

const productionService = useProductionService(); 
const toast = useToast();

// --- STATE DAFTAR PRODUKSI ---
const productionOrders = ref([]); // Data yang akan ditampilkan di grid
const loading = ref(true);
const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

// --- STATE MODAL ---
const showProductionModal = ref(false);
const editingOrder = ref(null); // Jika null, mode Create. Jika ada isinya, mode Edit.

// --- ACTIONS ---

const loadProductionOrders = async () => {
    loading.value = true;
    try {
        // Asumsi productionService.getAllOrders() mengembalikan array data produksi
        // Contoh: [{ uuid, name, notes, createdAt, total_target_count, flow_status }]
        const data = await productionService.getAllOrders();
        productionOrders.value = data || [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat daftar produksi', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const openCreateModal = () => {
    editingOrder.value = null;
    showProductionModal.value = true;
};

// [BARU] Menangani hasil sukses dari modal
const handleProductionCreated = (newOrder) => {
    toast.add({ severity: 'success', summary: 'Sukses', detail: `Order ${newOrder.name} berhasil dibuat.`, life: 3000 });
    showProductionModal.value = false;
    loadProductionOrders(); // Muat ulang daftar
};

// --- UTILS ---
const formatDate = (dateString) => {
    if(!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

const getStatusSeverity = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED') return 'success';
    if (s === 'IN_PROGRESS') return 'info';
    if (s === 'PENDING') return 'warning';
    return 'secondary';
};

onMounted(() => {
    loadProductionOrders();
});
</script>

<template>
    <div class="h-full flex flex-col bg-surface-50 dark:bg-surface-950">
        <Toast />

        <div class="flex items-center justify-between mb-4">
            <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Manajemen Produksi</h1>
            <div class="flex gap-2">
                <Button 
                    label="Buat Produksi" 
                    icon="pi pi-plus" 
                    severity="primary" 
                    class="!py-2"
                    @click="openCreateModal"
                />
            </div>
        </div>

        <div class="rounded-2xl shadow-sm border border-surface-200 dark:border-surface-800 overflow-hidden flex-1">
            
            <div class="p-4 border-b border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row justify-between gap-4 items-center bg-surface-50/50 dark:bg-surface-900">
                <div class="w-full sm:w-auto">
                    <IconField iconPosition="left">
                        <InputIcon class="pi pi-search text-surface-400" />
                        <InputText v-model="filters['global'].value" placeholder="Cari Nama Produksi, Catatan..." class="w-full sm:w-80 !rounded-lg pl-10" />
                    </IconField>
                </div>
                <Button icon="pi pi-refresh" severity="secondary" outlined size="small" @click="loadProductionOrders" />
            </div>

            <DataTable 
                :value="productionOrders" 
                dataKey="uuid"
                :loading="loading"
                paginator :rows="10" :rowsPerPageOptions="[10,20,50]"
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                rowHover
                class="text-sm"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400">
                        <i class="pi pi-factory text-4xl mb-2 opacity-50"></i>
                        <p>Belum ada order produksi yang tercatat.</p>
                    </div>
                </template>

                <Column field="name" header="Nama Produksi" sortable>
                    <template #body="slotProps">
                        <div class="font-bold text-surface-800 dark:text-surface-100">{{ slotProps.data.name }}</div>
                        <div class="text-[10px] text-surface-500 mt-1">Order dibuat: {{ formatDate(slotProps.data.createdAt) }}</div>
                    </template>
                </Column>
                
                <Column field="notes" header="Catatan" sortable>
                     <template #body="slotProps">
                        <span class="text-xs text-surface-600 italic max-w-[300px] truncate block" :title="slotProps.data.notes">
                            "{{ slotProps.data.notes || '-' }}"
                        </span>
                    </template>
                </Column>

                <Column style="width: 6rem; text-align: center">
                    <template #body="slotProps">
                        <Button 
                            icon="pi pi-eye" 
                            text 
                            rounded 
                            severity="secondary" 
                            size="small" 
                            v-tooltip.left="'Lihat Detail & Progress'" 
                            @click="editingOrder = slotProps.data; showProductionModal = true;"
                        />
                    </template>
                </Column>

            </DataTable>
        </div>
        
        <ProductionModal 
            v-model:visible="showProductionModal"
            :initial-order="editingOrder" 
            @order-submitted="handleProductionCreated" 
        />

    </div>
</template>