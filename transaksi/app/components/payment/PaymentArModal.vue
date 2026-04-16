<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Gunakan komponen yang sama
import PaymentMethodSelector from '~/components/payment/PaymentMethodSelector.vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    receivable: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const toast = useToast();

const paymentProcessing = ref(false);
const notes = ref('');

// Gunakan struktur data yang sama dengan PaymentMethodSelector
const paymentData = ref({
    paymentType: 'CASH', // Di set CASH (Lunas) terus karena ini adalah penerimaan cicilan/pembayaran
    cashAmount: 0,
    dueDate: null,
    paymentMethodUuid: null,
    paymentMethodCode: null
});

// Reset & set nilai awal setiap kali modal dibuka
watch(() => props.visible, (newVal) => {
    if (newVal && props.receivable) {
        paymentData.value = {
            paymentType: 'CASH',
            cashAmount: props.receivable.remaining, // Default terisi sisa tagihan
            dueDate: null,
            paymentMethodUuid: null,
            paymentMethodCode: null
        };
        notes.value = `Penerimaan Pembayaran Piutang Nota ${props.receivable.code}`;
    }
});

const handleClose = () => {
    emit('update:visible', false);
};

const processPayment = async () => {
    if (!props.receivable || paymentData.value.cashAmount <= 0 || paymentProcessing.value) return;

    if (paymentData.value.cashAmount > props.receivable.remaining) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Jumlah terima melebihi sisa tagihan.', life: 3000 });
        return;
    }
    
    paymentProcessing.value = true;
    try {
        const payload = {
            amount: paymentData.value.cashAmount,
            reference_journal_code: props.receivable.code,
            payment_method: paymentData.value.paymentMethodCode || 'CASH',
            payment_method_uuid: paymentData.value.paymentMethodUuid,
            notes: notes.value,
            member: props.receivable.member,
            member_uuid: props.receivable.memberUuid 
        };

        if (journalService.createArPaymentTransaction) {
            await journalService.createArPaymentTransaction({ details: payload });
        } else {
            await journalService.createTransaction({ details: { ...payload, transaction_type: 'PAY_AR' }});
        }

        toast.add({ severity: 'success', summary: 'Sukses', detail: `Pembayaran piutang berhasil dicatat.`, life: 3000 });
        emit('saved');
        handleClose();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi Kesalahan', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        header="Terima Pembayaran Piutang" 
        :modal="true" 
        class="w-[95vw] sm:w-[480px]" 
        :pt="{ root: { class: '!rounded-2xl !border-0 !shadow-2xl' }, header: { class: '!bg-surface-50 !border-b !border-surface-200 !pb-4' }, content: { class: '!pt-4 !pb-0' } }"
    >
        <div v-if="receivable" class="flex flex-col h-full">
            
            <div class="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col gap-2 relative overflow-hidden">
                <div class="absolute -right-4 -bottom-4 opacity-10"><i class="pi pi-money-bill text-8xl"></i></div>
                <div>
                    <span class="text-xs text-emerald-700/70 font-semibold uppercase tracking-wider block">Pelanggan / Member</span>
                    <span class="font-bold text-emerald-900 text-base">{{ receivable.member }}</span>
                </div>
                <div class="flex justify-between items-end mt-2 pt-2 border-t border-emerald-200/50 relative z-10">
                    <div>
                        <span class="text-[10px] text-emerald-700/70 font-semibold block mb-0.5">Sisa Tagihan</span>
                        <span class="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded text-emerald-800">{{ receivable.code }}</span>
                    </div>
                    <span class="text-2xl font-black text-emerald-700">{{ formatCurrency(receivable.remaining) }}</span>
                </div>
            </div>

            <div class="payment-selector-container">
                <PaymentMethodSelector 
                    v-model="paymentData" 
                    :grandTotal="receivable.remaining" 
                    type="sale" 
                    :hasCustomer="true"
                />
            </div>

            <div class="flex flex-col gap-1 mt-4">
                <label class="text-xs font-bold text-surface-600 uppercase">Catatan / Referensi Tambahan</label>
                <Textarea v-model="notes" rows="2" class="w-full !text-sm resize-none focus:!ring-emerald-500 focus:!border-emerald-500" placeholder="Cth: Via Transfer BCA a.n Bapak Budi..." />
            </div>

        </div>

        <template #footer>
            <div class="flex gap-2 w-full pt-4 border-t border-surface-200 mt-2">
                <Button label="Batal" class="flex-1 !rounded-xl font-bold" severity="secondary" text @click="handleClose" />
                <Button 
                    label="Terima Pembayaran" 
                    icon="pi pi-check-circle" 
                    class="flex-[2] !rounded-xl font-bold shadow-md" 
                    severity="success" 
                    @click="processPayment" 
                    :loading="paymentProcessing" 
                    :disabled="paymentData.cashAmount <= 0 || paymentData.cashAmount > receivable.remaining"
                />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* * 1. Sembunyikan toggle "Lunas/Piutang" di PaymentMethodSelector 
 * Karena ini khusus untuk modal penerimaan uang
 */
.payment-selector-container :deep(.p-selectbutton) {
    display: none !important;
}

/* * 2. Hilangkan background abu-abu dan border dari selector 
 * Agar desainnya menyatu (seamless) dengan modal
 */
.payment-selector-container :deep(.bg-surface-50.border) {
    background-color: transparent !important;
    border: none !important;
    padding: 0 !important;
}

/* Tambahan margin agar jarak antara InputNominal dan Box Metode proporsional */
.payment-selector-container :deep(.mt-4) {
    margin-top: 0.5rem !important; 
}
</style>