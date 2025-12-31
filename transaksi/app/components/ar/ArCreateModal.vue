<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const toast = useToast();

const processing = ref(false);

const transaction = reactive({
    amount: null,
    contactName: '',
    dueDate: null,
    notes: '',
});

// Reset form saat modal dibuka
watch(() => props.visible, (newVal) => {
    if (newVal) {
        transaction.amount = null;
        transaction.contactName = '';
        transaction.dueDate = null;
        transaction.notes = '';
        processing.value = false;
    }
});

const canSave = computed(() => {
    return transaction.amount > 0 && !!transaction.contactName && !!transaction.dueDate && !processing.value;
});

const handleClose = () => {
    emit('update:visible', false);
};

const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        const payload = {
            details: {
                amount: transaction.amount,
                due_date: transaction.dueDate ? transaction.dueDate.toISOString().split('T')[0] : null, 
                notes: transaction.notes,
                customer_name: transaction.contactName, // Spesifik Piutang
                is_credit: 'true',
            }
        };

        await journalService.createArTransaction(payload);

        toast.add({ 
            severity: 'success', 
            summary: 'Berhasil', 
            detail: 'Transaksi Piutang berhasil dicatat.', 
            life: 3000 
        });

        emit('saved'); 
        handleClose(); 

    } catch (e) {
        console.error("Error creating AR:", e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan', life: 3000 });
    } finally {
        processing.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        modal 
        header=" " 
        :style="{ width: '50rem' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
        :pt="{ header: { class: '!py-2' }, content: { class: '!p-0' } }"
    >
        <template #header>
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md bg-emerald-600 transition-colors duration-300">
                    <i class="pi pi-arrow-up-right"></i>
                </div>
                <div>
                    <span class="font-bold text-lg block">Catat Transaksi Piutang (AR)</span>
                    <span class="text-xs text-surface-500 font-normal">Pencatatan saldo awal atau piutang manual</span>
                </div>
            </div>
        </template>

        <div class="flex flex-col h-full bg-surface-0 dark:bg-surface-100">
            <div class="p-6 space-y-5">
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="field">
                        <label class="font-semibold text-sm mb-1 block">Nama Pelanggan <span class="text-red-500">*</span></label>
                        <InputText 
                            v-model="transaction.contactName" 
                            placeholder="Nama Customer / Peminjam"
                            class="w-full" 
                        />
                    </div>

                    <div class="field">
                        <label class="font-semibold text-sm mb-1 block">Jumlah Piutang <span class="text-red-500">*</span></label>
                        <InputNumber 
                            v-model="transaction.amount" 
                            mode="currency" 
                            currency="IDR" 
                            locale="id-ID" 
                            placeholder="0"
                            class="w-full"
                            inputClass="!font-mono"
                        />
                    </div>

                    <div class="field md:col-span-2">
                        <label class="font-semibold text-sm mb-1 block">Jatuh Tempo <span class="text-red-500">*</span></label>
                         <Calendar 
                            v-model="transaction.dueDate" 
                            dateFormat="dd/mm/yy" 
                            :minDate="new Date()" 
                            showIcon 
                            class="w-full" 
                            placeholder="Pilih Tanggal Jatuh Tempo"
                        />
                    </div>
                </div>
                
                <div class="field">
                    <label class="font-semibold text-sm mb-1 block">Catatan</label>
                    <Textarea v-model="transaction.notes" rows="2" placeholder="Keterangan tambahan..." class="w-full" />
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="handleClose" />
                <Button 
                    label="Simpan Piutang" 
                    icon="pi pi-check" 
                    :loading="processing" 
                    :disabled="!canSave"
                    severity="success"
                    @click="processTransaction" 
                />
            </div>
        </template>
    </Dialog>
</template>