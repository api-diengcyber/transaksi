<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import ArapDebtPaymentList from '~/components/ArapDebtPaymentList.vue';
import ArapGlobalDebtModal from '~/components/ArapGlobalDebtModal.vue'; 

const toast = useToast();

const debtPaymentRef = ref(null);

const globalDebtModalRef = ref(null);

const showCreateModal = ref(false);

const onDebtSaved = () => {
    showCreateModal.value = false;
    setTimeout(() => {
        if (debtPaymentRef.value && debtPaymentRef.value.refreshData) {
            debtPaymentRef.value.refreshData();
        }
    }, 100);
}

// Handler untuk tombol "Simpan" di footer modal
const handleSaveGlobalDebt = async () => {
    if (globalDebtModalRef.value && globalDebtModalRef.value.processTransaction) {
        await globalDebtModalRef.value.processTransaction();
    }
}

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="h-[calc(100vh-5rem)]">
        <Toast />
        
        <div class="flex items-center justify-between mb-4">
             <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Piutang & Hutang (AR/AP)</h1>
             <div class="flex items-center gap-2">
                <Button 
                    :label="'Buat Nota Global Baru'"
                    icon="pi pi-plus-circle" 
                    severity="primary" 
                    @click="showCreateModal = true"
                    size="small" 
                />
             </div>
        </div>
        
        <div class="flex-1 overflow-hidden">
            <ArapDebtPaymentList
                ref="debtPaymentRef"
                class="h-full"
            />
        </div>

        <Dialog 
            v-model:visible="showCreateModal" 
            modal 
            header="Buat Piutang/Hutang Global Baru" 
            :style="{ width: '700px' }" 
            class="p-fluid"
            :pt="{ content: { class: 'p-0' } }"
        >
             <ArapGlobalDebtModal 
                v-if="showCreateModal" 
                ref="globalDebtModalRef"
                @saved="onDebtSaved" 
            />

            <template #footer>
                <Button label="Batal" icon="pi pi-times" text @click="showCreateModal = false" severity="secondary" />
                <Button 
                    :label="`CATAT ${globalDebtModalRef?.activeDebtType?.toUpperCase() || ''}`"
                    icon="pi pi-save" 
                    :severity="globalDebtModalRef?.activeDebtType === 'piutang' ? 'success' : 'danger'"
                    @click="handleSaveGlobalDebt"
                    :disabled="!globalDebtModalRef?.canSave || globalDebtModalRef?.processing"
                    :loading="globalDebtModalRef?.processing"
                />
            </template>
        </Dialog>
    </div>
</template>