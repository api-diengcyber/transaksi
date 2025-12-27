<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    defaultType: {
        type: String,
        default: 'piutang' // 'piutang' atau 'hutang'
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const toast = useToast();

const activeDebtType = ref('piutang'); 
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
        activeDebtType.value = props.defaultType;
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

const typeIcon = computed(() => activeDebtType.value === 'piutang' ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-left');

const handleClose = () => {
    emit('update:visible', false);
};

const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        const type = activeDebtType.value;
        const payload = {
            details: {
                amount: transaction.amount,
                due_date: transaction.dueDate ? transaction.dueDate.toISOString().split('T')[0] : null, 
                notes: transaction.notes,
                ...(type === 'piutang' ? { customer_name: transaction.contactName } : {}),
                ...(type === 'hutang' ? { supplier: transaction.contactName } : {}),
                is_credit: 'true',
            }
        };

        if (type === 'piutang') {
            await journalService.createArTransaction(payload);
        } else {
            await journalService.createApTransaction(payload);
        }

        toast.add({ 
            severity: 'success', 
            summary: 'Berhasil', 
            detail: `Transaksi ${type === 'piutang' ? 'Piutang' : 'Hutang'} berhasil dicatat.`, 
            life: 3000 
        });

        emit('saved'); // Beritahu parent untuk refresh data
        handleClose(); // Tutup modal

    } catch (e) {
        console.error("Error creating global debt:", e);
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
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md transition-colors duration-300"
                     :class="[activeDebtType === 'piutang' ? 'bg-emerald-600' : 'bg-red-600']"
                >
                    <i :class="typeIcon"></i>
                </div>
                <div>
                    <span class="font-bold text-lg block">Catat Transaksi {{ activeDebtType === 'piutang' ? 'Piutang' : 'Hutang' }}</span>
                    <span class="text-xs text-surface-500 font-normal">Saldo awal atau pinjaman manual</span>
                </div>
            </div>
        </template>

        <div 
            class="flex flex-col h-full bg-surface-0 dark:bg-surface-900 transition-colors duration-500"
        >
            <div class="p-6 space-y-5">
                
                <div class="field">
                    <SelectButton 
                        v-model="activeDebtType" 
                        :options="[{label: 'Piutang (AR)', value: 'piutang'}, {label: 'Hutang (AP)', value: 'hutang'}]"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                        :pt="{ 
                            button: ({ context }) => ({ 
                                class: [
                                    '!text-sm !py-2 !font-bold w-1/2',
                                    context.active ? (activeDebtType === 'piutang' ? '!bg-emerald-600 !border-emerald-600' : '!bg-red-600 !border-red-600') : ''
                                ] 
                            }) 
                        }"
                    />
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="field">
                        <label class="font-semibold text-sm mb-1 block">Nama {{ activeDebtType === 'piutang' ? 'Pelanggan' : 'Supplier' }} <span class="text-red-500">*</span></label>
                        <InputText 
                            v-model="transaction.contactName" 
                            :placeholder="activeDebtType === 'piutang' ? 'Nama Peminjam / Customer' : 'Nama Pemberi Pinjaman / Supplier'"
                            class="w-full" 
                        />
                    </div>

                    <div class="field">
                        <label class="font-semibold text-sm mb-1 block">Jumlah Nominal <span class="text-red-500">*</span></label>
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
                            placeholder="Pilih Tanggal"
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
                    label="Simpan Transaksi" 
                    icon="pi pi-check" 
                    :loading="processing" 
                    :disabled="!canSave"
                    :severity="activeDebtType === 'piutang' ? 'success' : 'danger'"
                    @click="processTransaction" 
                />
            </div>
        </template>
    </Dialog>
</template>