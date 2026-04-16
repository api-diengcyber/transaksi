<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import PaymentMethodSelector from '~/components/payment/PaymentMethodSelector.vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    payable: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const toast = useToast();

const paymentProcessing = ref(false);
const notes = ref('');

const paymentData = ref({
    paymentType: 'CASH', // Karena ini form bayar hutang, default CASH (Lunas)
    cashAmount: 0,
    dueDate: null,
    paymentMethodUuid: null,
    paymentMethodCode: null
});

// Reset form tiap kali popup dibuka
watch(() => props.visible, (newVal) => {
    if (newVal && props.payable) {
        paymentData.value = {
            paymentType: 'CASH',
            cashAmount: props.payable.remaining,
            dueDate: null,
            paymentMethodUuid: null,
            paymentMethodCode: null
        };
        notes.value = `Pembayaran Hutang Nota ${props.payable.code}`;
    }
});

const handleClose = () => {
    emit('update:visible', false);
};

const processPayment = async () => {
    if (!props.payable || paymentData.value.cashAmount <= 0 || paymentProcessing.value) return;

    if (paymentData.value.cashAmount > props.payable.remaining) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Jumlah bayar melebihi sisa kewajiban.', life: 3000 });
        return;
    }
    
    paymentProcessing.value = true;
    try {
        const payload = {
            amount: paymentData.value.cashAmount,
            reference_journal_code: props.payable.code,
            payment_method: paymentData.value.paymentMethodCode || 'CASH',
            payment_method_uuid: paymentData.value.paymentMethodUuid,
            notes: notes.value,
            supplier: props.payable.supplier,
            supplier_uuid: props.payable.supplierUuid
        };

        if (journalService.createApPaymentTransaction) {
            await journalService.createApPaymentTransaction({ details: payload });
        } else {
            await journalService.createTransaction({ details: { ...payload, transaction_type: 'PAY_AP' }});
        }

        toast.add({ severity: 'success', summary: 'Sukses', detail: `Pembayaran keluar berhasil dicatat.`, life: 3000 });
        emit('saved');
        handleClose();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi Kesalahan', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        header="Bayar Hutang Supplier" 
        :modal="true" 
        class="w-[95vw] sm:w-[480px]" 
        :pt="{ root: { class: '!rounded-2xl !border-0 !shadow-2xl' }, header: { class: '!bg-surface-50 !border-b !border-surface-200 !pb-4' }, content: { class: '!pt-4 !pb-0' } }"
    >
        <div v-if="payable" class="flex flex-col h-full">
            
            <div class="mb-4 p-4 bg-rose-50 rounded-xl border border-rose-100 flex flex-col gap-2 relative overflow-hidden">
                <div class="absolute -right-4 -bottom-4 opacity-10"><i class="pi pi-money-bill text-8xl"></i></div>
                <div>
                    <span class="text-xs text-rose-700/70 font-semibold uppercase tracking-wider block">Supplier / Vendor</span>
                    <span class="font-bold text-rose-900 text-base">{{ payable.supplier }}</span>
                </div>
                <div class="flex justify-between items-end mt-2 pt-2 border-t border-rose-200/50 relative z-10">
                    <div>
                        <span class="text-[10px] text-rose-700/70 font-semibold block mb-0.5">Sisa Kewajiban</span>
                        <span class="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded text-rose-800">{{ payable.code }}</span>
                    </div>
                    <span class="text-2xl font-black text-rose-700">{{ formatCurrency(payable.remaining) }}</span>
                </div>
            </div>

            <div class="payment-selector-container">
                <PaymentMethodSelector 
                    v-model="paymentData" 
                    :grandTotal="payable.remaining" 
                    type="buy" 
                    :hasCustomer="true"
                />
            </div>

            <div class="flex flex-col gap-1 mt-4">
                <label class="text-xs font-bold text-surface-600 uppercase">Catatan / Bukti Transfer</label>
                <Textarea v-model="notes" rows="2" class="w-full !text-sm resize-none focus:!ring-rose-500 focus:!border-rose-500" placeholder="Cth: Transfer via Mandiri..." />
            </div>

        </div>

        <template #footer>
            <div class="flex gap-2 w-full pt-4 border-t border-surface-200 mt-2">
                <Button label="Batal" class="flex-1 !rounded-xl font-bold" severity="secondary" text @click="handleClose" />
                <Button 
                    label="Proses Pembayaran" 
                    icon="pi pi-check-circle" 
                    class="flex-[2] !rounded-xl font-bold shadow-md" 
                    severity="danger" 
                    @click="processPayment" 
                    :loading="paymentProcessing" 
                    :disabled="paymentData.cashAmount <= 0 || paymentData.cashAmount > payable.remaining"
                />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* Sembunyikan toggle dan border bawaan agar menyatu di dalam modal */
.payment-selector-container :deep(.p-selectbutton) { display: none !important; }
.payment-selector-container :deep(.bg-surface-50.border) { background-color: transparent !important; border: none !important; padding: 0 !important; }
.payment-selector-container :deep(.mt-4) { margin-top: 0.5rem !important; }
.payment-selector-container :deep(.text-emerald-600) { color: #e11d48 !important; } /* Sesuaikan warna input ke Rose untuk Hutang */
</style>