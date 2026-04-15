<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useJournalService } from '~/composables/useJournalService';
import PaymentMethodSelector from '~/components/payment/PaymentMethodSelector.vue';

const props = defineProps({
  visible: { type: Boolean, required: true },
  cart: { type: Array, required: true },
  grandTotal: { type: Number, required: true },
  suppliers: { type: Array, required: true }
});

const emit = defineEmits(['update:visible', 'checkout-success']);

const authStore = useAuthStore();
const toast = useToast();
const journalService = useJournalService();

const processing = ref(false);

const transactionMeta = reactive({
  transactionDate: new Date(),
  supplierUuid: null,
  manualInvoiceCode: ''
});

// State Selector Pembayaran
const paymentData = reactive({
  paymentType: 'CASH',
  paymentMethodUuid: null,
  paymentMethodCode: 'CASH',
  cashAmount: 0,
  dueDate: null
});

// Computed Settings
const invoiceType = computed(() => authStore.getSetting('purchase_invoice_number_type', 'system'));
const isManualInvoice = computed(() => invoiceType.value === 'manual');
const isCreditSale = computed(() => paymentData.paymentType === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditSale.value) return 0;
    return paymentData.cashAmount - props.grandTotal;
});

const canCheckout = computed(() => {
    if (props.cart.length === 0) return false;
    if (processing.value) return false;
    
    if (isManualInvoice.value && !transactionMeta.manualInvoiceCode.trim()) return false;

    if (isCreditSale.value) {
        return !!transactionMeta.supplierUuid && paymentData.dueDate;
    } else {
        return paymentData.cashAmount >= props.grandTotal;
    }
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    paymentData.paymentType = 'CASH';
    paymentData.cashAmount = props.grandTotal;
    paymentData.dueDate = null;

    if (!isManualInvoice.value && invoiceType.value !== 'system') {
        transactionMeta.manualInvoiceCode = generateInvoiceNumber();
    }
  }
});

const generateInvoiceNumber = () => {
    const type = invoiceType.value;
    if (type === 'system' || type === 'manual') return null;

    const prefix = String(authStore.getSetting('purchase_invoice_prefix') || 'PO-').toUpperCase();
    const suffix = String(authStore.getSetting('purchase_invoice_suffix') || '').toUpperCase();
    const length = Number(authStore.getSetting('purchase_invoice_length')) || 5;
    let randomPart = '';

    if (type === 'numeric') {
        randomPart = String(new Date().getTime()).slice(-length);
    } else if (type === 'alphanumeric') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        for (let i = 0; i < length; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    return `${prefix}${randomPart}${suffix}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const processCheckout = async () => {
    if (!canCheckout.value) return;
    processing.value = true;

    try {
        const itemsPayload = props.cart.map(item => ({
            product_uuid: item.productUuid,
            variant_uuid: item.variantUuid || null, 
            unit_uuid: item.unitUuid,
            qty: item.qty,
            price: item.price,
            subtotal: item.qty * item.price,
            item_name: item.name,
            unit_name: item.unitName,
            note: item.note || '',
            
            tax_percentage: item.buyTaxPercentage,
            tax_amount: (item.price * item.qty) * (item.buyTaxPercentage / 100),

            stok_product_uuid: item.productUuid,
            stok_variant_uuid: item.variantUuid || null,
            stok_unit: item.unitUuid,
            stok_qty_plus: item.qty, 
            stok_shelve_uuid: item.shelveUuid, 
            shelve_uuid: item.shelveUuid 
        }));

        let catatan = '';
        if (isCreditSale.value) {
            catatan = paymentData.cashAmount > 0 
                ? `Hutang (Kredit) - DP: ${formatCurrency(paymentData.cashAmount)}`
                : `Hutang (Kredit) Penuh`;
        } else {
            catatan = `Lunas Pembelian: ${formatCurrency(paymentData.cashAmount)}`;
        }

        const payload = {
            grand_total: props.grandTotal,
            total_items: props.cart.length,
            payment_method: paymentData.paymentMethodCode || 'CASH',
            notes: catatan,
            status: isCreditSale.value ? 'PENDING' : 'COMPLETED',
            amount_cash: paymentData.cashAmount,
            transaction_date: transactionMeta.transactionDate ? transactionMeta.transactionDate.toISOString() : new Date().toISOString(),
            
            ...(invoiceType.value !== 'system' && { custom_journal_code: transactionMeta.manualInvoiceCode }),

            ...(isCreditSale.value && {
                is_credit: 'true',
                due_date: paymentData.dueDate ? paymentData.dueDate.toISOString().split('T')[0] : null
            }),
            amount_credit: isCreditSale.value ? props.grandTotal : 0, 
            shipping_cost: 0, 
            supplier_uuid: transactionMeta.supplierUuid || null, 
            items: itemsPayload
        };

        await journalService.createBuyTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Pembelian Berhasil Dicatat', life: 3000 });
        emit('checkout-success'); 
        emit('update:visible', false);

        transactionMeta.supplierUuid = null;

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memproses transaksi', life: 3000 });
    } finally { 
        processing.value = false; 
    }
};
</script>

<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)" 
    class="w-full max-w-4xl m-4 !p-0" 
    :pt="{ root: { class: '!border-0 !shadow-2xl !rounded-2xl' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-2xl' } }" 
    modal dismissableMask
  >
        <div class="bg-surface-0 flex flex-col max-h-[95vh] rounded-2xl overflow-hidden relative">
            
            <div class="flex justify-between items-center px-6 py-5 border-b border-surface-200 bg-surface-50 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <i class="pi pi-shopping-cart text-xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-xl text-surface-800 leading-tight">Proses Pembelian (Restock)</h3>
                        <p class="text-xs text-surface-500 font-medium mt-0.5">Selesaikan data tagihan ke Supplier</p>
                    </div>
                </div>
                <button @click="$emit('update:visible', false)" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition"><i class="pi pi-times"></i></button>
            </div>

            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div class="w-full lg:w-[40%] bg-surface-50 border-r border-surface-200 flex flex-col shrink-0">
                    <div class="p-6 flex-1 flex flex-col justify-center">
                        <div class="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg shadow-emerald-500/30 relative overflow-hidden flex flex-col items-center justify-center text-center h-48">
                            <i class="pi pi-truck absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
                            <span class="text-sm uppercase font-bold tracking-widest text-emerald-200 mb-2">Total Pembelian</span>
                            <div class="text-4xl md:text-5xl font-black text-white drop-shadow-md">{{ formatCurrency(grandTotal) }}</div>
                        </div>

                        <div class="mt-8 space-y-4 px-2">
                            <div class="flex justify-between items-center pb-4 border-b border-surface-200 border-dashed" v-if="!isCreditSale">
                                <span class="text-sm font-bold text-surface-500 uppercase tracking-wider">Total Kas Keluar</span>
                                <span class="text-2xl font-black font-mono text-emerald-600">{{ formatCurrency(paymentData.cashAmount) }}</span>
                            </div>
                            
                            <div class="flex justify-between items-center pb-4 border-b border-surface-200 border-dashed" v-else>
                                <span class="text-sm font-bold text-orange-600 uppercase tracking-wider">Total Hutang (Minus DP)</span>
                                <span class="text-2xl font-black font-mono text-orange-600">{{ formatCurrency(props.grandTotal - paymentData.cashAmount) }}</span>
                            </div>

                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-surface-500">Jumlah Item Masuk</span>
                                <span class="text-sm font-bold text-surface-800">{{ cart.length }} Item</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-[60%] flex flex-col flex-1 overflow-y-auto scrollbar-thin bg-surface-0">
                    <div class="p-6 md:p-8 space-y-6">
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="p-3 bg-surface-50 border border-surface-200 rounded-xl" v-if="invoiceType !== 'system'">
                                <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">No. Faktur Beli / PO</label>
                                <InputText v-if="isManualInvoice" v-model="transactionMeta.manualInvoiceCode" placeholder="Ketik No PO Manual..." class="w-full !text-sm font-mono font-bold" />
                                <div v-else class="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-surface-200 font-mono font-bold text-emerald-700 text-sm shadow-sm">
                                    <span>{{ transactionMeta.manualInvoiceCode }}</span>
                                    <button class="text-surface-400 hover:text-emerald-600 transition" @click="transactionMeta.manualInvoiceCode = generateInvoiceNumber()" v-tooltip.top="'Generate Ulang'"><i class="pi pi-refresh"></i></button>
                                </div>
                            </div>
                            
                            <div class="p-3 bg-surface-50 border border-surface-200 rounded-xl flex flex-col justify-center" :class="{'md:col-span-2': invoiceType === 'system'}">
                                <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Pilih Supplier <span class="text-red-500" v-if="isCreditSale">*</span></label>
                                <Dropdown v-model="transactionMeta.supplierUuid" :options="suppliers" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Supplier..." class="w-full !text-sm" showClear />
                            </div>
                        </div>

                        <Divider type="dashed" />

                        <PaymentMethodSelector 
                            v-model="paymentData"
                            :grand-total="grandTotal"
                            type="buy"
                            :has-customer="!!transactionMeta.supplierUuid"
                        />

                    </div>
                </div>
            </div>

            <div class="px-6 py-4 border-t border-surface-200 bg-surface-50 shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.03)] z-10">
                <div class="flex flex-col sm:flex-row gap-3 justify-end">
                    <Button label="Kembali" icon="pi pi-arrow-left" class="sm:w-32 font-bold !rounded-xl" severity="secondary" outlined @click="$emit('update:visible', false)" :disabled="processing" />
                    
                    <Button 
                        :label="isCreditSale ? 'Catat Hutang' : 'Selesaikan Pembelian'" 
                        icon="pi pi-check"
                        class="w-full sm:w-auto px-8 !h-12 !text-sm !font-bold !rounded-xl shadow-sm transition-colors" 
                        :severity="isCreditSale ? 'warning' : 'success'" 
                        :loading="processing" 
                        :disabled="!canCheckout" 
                        @click="processCheckout" 
                    />
                </div>
            </div>

        </div>
    </Dialog>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.4); border-radius: 10px; }
.scrollbar-thin:hover::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.8); }
</style>