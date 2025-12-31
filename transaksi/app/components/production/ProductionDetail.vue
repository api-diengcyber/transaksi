<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const props = defineProps({
    production: { type: Object, required: true },
    userList: { type: Array, default: () => [] }
});

const emit = defineEmits(['edit-production', 'delete-production']);

const productionService = useProductionService();
const toast = useToast();
const confirm = useConfirm();

// --- STATE LOKAL ---
const flows = ref([]);
const loadingFlows = ref(false);
const matrixValues = ref({}); // Format: { [userUuid]: { [flowUuid]: value } }

// --- STATE FORM FLOW ---
const showFlowDialog = ref(false);
const isEditFlow = ref(false);
const flowForm = ref({
    uuid: null,
    stepName: '',
    stepOrder: 1,
    workerUserUuids: [], 
    isCompleted: false
});

// ================= ACTIONS: LOAD DATA =================

const loadFlows = async () => {
    loadingFlows.value = true;
    try {
        const data = await productionService.getFlowsByProduction(props.production.uuid);
        flows.value = (data || []).sort((a, b) => a.stepOrder - b.stepOrder);
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat langkah produksi' });
    } finally {
        loadingFlows.value = false;
    }
};

// ================= ACTIONS: FLOW CRUD =================

const openCreateFlow = () => {
    isEditFlow.value = false;
    // Cari urutan terakhir
    const lastOrder = flows.value.length > 0 
        ? Math.max(...flows.value.map(f => f.stepOrder)) 
        : 0;

    flowForm.value = {
        uuid: null,
        stepName: '',
        stepOrder: lastOrder + 1,
        workerUserUuids: [],
        isCompleted: false
    };
    showFlowDialog.value = true;
};

const editFlowColumn = (flow) => {
    isEditFlow.value = true;
    // Mapping workerUserUuids dari object workers
    const currentWorkerUuids = flow.workers ? flow.workers.map(w => w.userUuid) : [];
    
    flowForm.value = {
        uuid: flow.uuid,
        stepName: flow.stepName,
        stepOrder: flow.stepOrder,
        workerUserUuids: currentWorkerUuids,
        isCompleted: flow.isCompleted
    };
    showFlowDialog.value = true;
};

const saveFlow = async () => {
    if (!flowForm.value.stepName) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama langkah wajib diisi' });
        return;
    }

    try {
        const payload = {
            productionUuid: props.production.uuid,
            stepName: flowForm.value.stepName,
            stepOrder: flowForm.value.stepOrder,
            workerUserUuids: flowForm.value.workerUserUuids,
            isCompleted: flowForm.value.isCompleted
        };

        if (isEditFlow.value) {
            await productionService.updateFlow(flowForm.value.uuid, payload);
        } else {
            await productionService.createFlow(payload);
        }

        await loadFlows(); // Reload flows untuk update kolom
        showFlowDialog.value = false;
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Langkah berhasil disimpan' });

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal menyimpan langkah' });
    }
};

const confirmDeleteFlow = (flow) => {
    confirm.require({
        message: `Hapus langkah "${flow.stepName}"?`,
        header: 'Hapus Langkah',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await productionService.deleteFlow(flow.uuid);
                await loadFlows();
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Langkah dihapus' });
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus langkah' });
            }
        }
    });
};

// ================= LOGIC: MATRIX =================

const getMatrixValue = (userUuid, flowUuid) => {
    return matrixValues.value[userUuid]?.[flowUuid] || null;
};

const updateMatrixValue = (userUuid, flowUuid, newValue) => {
    if (!matrixValues.value[userUuid]) matrixValues.value[userUuid] = {};
    matrixValues.value[userUuid][flowUuid] = newValue;
};

const isCellDisabled = (flow, userUuid) => {
    if (!flow.workers || flow.workers.length === 0) return true;
    return !flow.workers.some(w => w.userUuid === userUuid);
};

// --- UTILS ---
const formatDate = (date) => {
    if(!date) return '-';
    return new Date(date).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour:'2-digit', minute:'2-digit' });
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
};

// Load data saat komponen dimuat (lazy load handled by parent TabView lazy prop)
onMounted(() => {
    loadFlows();
});
</script>

<template>
    <div class="h-full flex flex-col">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 p-4 bg-surface-50 dark:bg-surface-100 rounded-lg border border-surface-100 dark:border-surface-800">
            <div class="flex flex-col">
                <span class="text-xs font-bold text-surface-400 uppercase tracking-wide">Info Produksi</span>
                <div class="text-sm mt-1">
                    <span class="font-medium">Dibuat:</span> {{ formatDate(production.createdAt) }}
                </div>
                <div class="text-sm text-surface-500 italic mt-1 max-w-md">
                    "{{ production.notes || 'Tidak ada catatan' }}"
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="Tambah Langkah (Kolom)" icon="pi pi-plus" size="small" outlined @click="openCreateFlow" />
                <Button icon="pi pi-pencil" label="Edit Info" size="small" severity="secondary" text @click="emit('edit-production', production)" />
                <Button icon="pi pi-trash" size="small" severity="danger" text @click="emit('delete-production', production)" />
            </div>
        </div>

        <DataTable 
            :value="userList" 
            scrollable 
            scrollHeight="flex"
            showGridlines
            stripedRows
            class="text-sm flex-1"
            :loading="loadingFlows"
        >
            <template #empty>Tidak ada data pegawai.</template>

            <Column field="name" header="Pegawai" frozen style="min-width: 200px" class="font-bold bg-surface-50">
                <template #body="{ data }">
                    <div class="flex items-center gap-2">
                        <Avatar :label="getInitials(data.username)" shape="circle" size="small" class="bg-primary-100 text-primary-700" />
                        <span>{{ data.username }}</span>
                    </div>
                </template>
            </Column>

            <Column 
                v-for="(flow) in flows" 
                :key="flow.uuid" 
                style="min-width: 150px; text-align: center;"
            >
                <template #header>
                    <div class="flex items-center justify-between w-full group">
                        <div class="flex flex-col items-start overflow-hidden">
                            <span class="font-bold truncate w-full" :title="flow.stepName">{{ flow.stepName }}</span>
                            <span class="text-[10px] font-normal text-surface-500">Step {{ flow.stepOrder }}</span>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-0/80 backdrop-blur-sm p-1 rounded-md shadow-sm">
                            <i class="pi pi-pencil text-surface-400 hover:text-blue-500 cursor-pointer text-xs" @click.stop="editFlowColumn(flow)"></i>
                            <i class="pi pi-times text-surface-400 hover:text-red-500 cursor-pointer text-xs" @click.stop="confirmDeleteFlow(flow)"></i>
                        </div>
                    </div>
                </template>

                <template #body="{ data: user }">
                    <div :class="{'opacity-40 grayscale cursor-not-allowed': isCellDisabled(flow, user.uuid)}">
                        <InputNumber 
                            :modelValue="getMatrixValue(user.uuid, flow.uuid)"
                            @update:modelValue="(val) => updateMatrixValue(user.uuid, flow.uuid, val)"
                            :disabled="isCellDisabled(flow, user.uuid)"
                            placeholder="-"
                            class="w-full input-center"
                            :min="0"
                            size="small"
                            :pt="{
                                input: { class: isCellDisabled(flow, user.uuid) ? '!bg-surface-100 dark:!bg-surface-800' : '' }
                            }"
                        />
                    </div>
                </template>
            </Column>
            
            <template #footer v-if="flows.length === 0">
                <div class="p-2 text-center text-surface-500 italic">
                    Belum ada langkah produksi. Klik "Tambah Langkah" untuk membuat kolom.
                </div>
            </template>
        </DataTable>

        <Dialog 
            v-model:visible="showFlowDialog" 
            :header="isEditFlow ? 'Edit Kolom Langkah' : 'Tambah Kolom Langkah'" 
            modal 
            class="w-full max-w-md"
            :draggable="false"
        >
            <div class="flex flex-col gap-4 mt-2">
                <div class="flex flex-col gap-1">
                    <label class="font-semibold text-sm">Urutan</label>
                    <InputNumber v-model="flowForm.stepOrder" showButtons :min="1" class="w-full" />
                </div>
                
                <div class="flex flex-col gap-1">
                    <label class="font-semibold text-sm">Nama Langkah</label>
                    <InputText v-model="flowForm.stepName" placeholder="Contoh: Potong, Jahit, Packing" class="w-full" autofocus />
                </div>

                <div class="flex flex-col gap-1">
                    <label class="font-semibold text-sm">Pegawai Penanggung Jawab</label>
                    <MultiSelect 
                        v-model="flowForm.workerUserUuids" 
                        :options="userList" 
                        optionLabel="username" 
                        optionValue="uuid" 
                        placeholder="Pilih Pegawai" 
                        filter
                        display="chip"
                        class="w-full"
                    />
                    <small class="text-surface-500">Hanya pegawai terpilih yang bisa menginput nilai.</small>
                </div>

                <div class="flex items-center gap-2 mt-2">
                    <Checkbox v-model="flowForm.isCompleted" :binary="true" inputId="status_check" />
                    <label for="status_check" class="text-sm cursor-pointer">Tandai langkah ini sudah selesai</label>
                </div>
            </div>

            <template #footer>
                <Button label="Batal" text severity="secondary" @click="showFlowDialog = false" />
                <Button label="Simpan Kolom" icon="pi pi-check" @click="saveFlow" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.input-center :deep(input) {
    text-align: center;
}
</style>