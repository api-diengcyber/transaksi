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

// State Selector Pembayaran (diubah jadi ref agar sinkron dengan v-model anak)
const paymentData = ref({
  paymentType: 'CASH',
  paymentMethodUuid: null,
  paymentMethodCode: 'CASH',
  cashAmount: 0,
  dueDate: null
});

// Computed Settings
const isCreditSale = computed(() => paymentData.value.paymentType === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditSale.value) return 0;
    return paymentData.value.cashAmount - props.grandTotal;
});

const canCheckout = computed(() => {
    if (props.cart.length === 0) return false;
    if (processing.value) return false;
    
    if (isCreditSale.value) {
        // Pembelian kredit wajib pilih supplier dan tanggal jatuh tempo
        return !!transactionMeta.supplierUuid && !!paymentData.value.dueDate;
    } else {
        // Pembelian tunai, pastikan uang yang dibayarkan cukup
        return paymentData.value.cashAmount >= props.grandTotal && !!paymentData.value.paymentMethodUuid;
    }
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    paymentData.value.paymentType = 'CASH';
    paymentData.value.cashAmount = props.grandTotal;
    paymentData.value.dueDate = null;
    paymentData.value.paymentMethodUuid = null;

    // Reset input faktur manual setiap modal dibuka
    transactionMeta.manualInvoiceCode = '';
  }
});

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
            catatan = paymentData.value.cashAmount > 0 
                ? `Hutang (Kredit) - DP: ${formatCurrency(paymentData.value.cashAmount)} via ${paymentData.value.paymentMethodCode}`
                : `Hutang (Kredit) Penuh`;
        } else {
            catatan = `Lunas Pembelian: ${formatCurrency(paymentData.value.cashAmount)} via ${paymentData.value.paymentMethodCode}`;
        }

        const payload = {
            grand_total: props.grandTotal,
            total_items: props.cart.length,
            payment_method: paymentData.value.paymentMethodCode || 'CASH',
            notes: catatan,
            status: isCreditSale.value ? 'PENDING' : 'COMPLETED',
            amount_cash: paymentData.value.cashAmount,
            transaction_date: transactionMeta.transactionDate ? transactionMeta.transactionDate.toISOString() : new Date().toISOString(),
            
            // Mengirim parameter jika diisi oleh user
            ...(transactionMeta.manualInvoiceCode.trim() && { custom_journal_code: transactionMeta.manualInvoiceCode.trim() }),

            ...(isCreditSale.value && {
                is_credit: 'true',
                due_date: paymentData.value.dueDate ? paymentData.value.dueDate.toISOString().split('T')[0] : null
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
    class="w-full max-w-5xl m-4 !p-0" 
    :pt="{ root: { class: '!border-0 !shadow-2xl !rounded-2xl' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-2xl' } }" 
    modal dismissableMask
  >
        <div class="bg-surface-0 flex flex-col max-h-[95vh] rounded-2xl overflow-hidden relative">
            
            <div class="flex justify-between items-center px-6 py-5 border-b border-surface-200 bg-surface-50 shrink-0">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                        <i class="pi pi-shopping-cart text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-xl text-surface-800 leading-tight tracking-tight">Proses Pembelian (Restock)</h3>
                        <p class="text-xs text-surface-500 font-medium mt-0.5">Selesaikan data tagihan ke Supplier</p>
                    </div>
                </div>
                <button @click="$emit('update:visible', false)" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-red-100 hover:text-red-500 text-surface-600 transition-colors"><i class="pi pi-times font-bold"></i></button>
            </div>

            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div class="w-full lg:w-[40%] bg-surface-50 border-r border-surface-200 flex flex-col shrink-0">
                    <div class="p-6 md:p-8 flex-1 flex flex-col">
                        
                        <div class="bg-emerald-600 text-white rounded-3xl p-6 shadow-lg shadow-emerald-500/30 relative overflow-hidden flex flex-col items-center justify-center text-center h-56 mb-8 border border-emerald-500">
                            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/50 to-emerald-800/50"></div>
                            <i class="pi pi-truck absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
                            
                            <span class="text-xs uppercase font-black tracking-widest text-emerald-200 mb-2 relative z-10 drop-shadow-sm">Total Tagihan</span>
                            <div class="text-5xl font-black text-white drop-shadow-md relative z-10">{{ formatCurrency(grandTotal) }}</div>
                        </div>

                        <div class="flex-1 flex flex-col justify-end space-y-5 px-2">
                            <div class="flex justify-between items-center pb-5 border-b border-surface-200 border-dashed" v-if="!isCreditSale">
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-surface-500 uppercase tracking-wider">Total Kas Keluar</span>
                                </div>
                                <span class="text-3xl font-black font-mono text-emerald-500">
                                    {{ formatCurrency(paymentData.cashAmount) }}
                                </span>
                            </div>
                            
                            <div class="flex justify-between items-center pb-5 border-b border-surface-200 border-dashed" v-else>
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-orange-600 uppercase tracking-wider">Sisa Hutang</span>
                                    <span class="text-[10px] text-surface-400 font-medium">Setelah dikurangi Uang Muka (DP)</span>
                                </div>
                                <span class="text-3xl font-black font-mono text-orange-600">
                                    {{ formatCurrency(props.grandTotal - paymentData.cashAmount) }}
                                </span>
                            </div>

                            <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                                <div class="flex items-center gap-3">
                                    <i class="pi pi-box text-surface-400"></i>
                                    <span class="text-sm font-bold text-surface-600">Jumlah Item Masuk</span>
                                </div>
                                <span class="text-lg font-black text-surface-800 bg-surface-100 px-3 py-1 rounded-lg">{{ cart.length }} Item</span>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="w-full lg:w-[60%] flex flex-col flex-1 overflow-y-auto scrollbar-thin bg-surface-0">
                    <div class="p-6 md:p-8 space-y-8">
                        
                        <section>
                            <h4 class="text-xs font-black text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="pi pi-receipt"></i> Data Transaksi</h4>
                            
                            <div class="flex flex-col gap-4">
                                <div class="p-4 bg-surface-50 border border-surface-200 rounded-xl shadow-sm">
                                    <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">No. Faktur / PO Pembelian</label>
                                    <InputText v-model="transactionMeta.manualInvoiceCode" placeholder="Kosongkan untuk otomatis" class="w-full !text-sm font-mono font-bold" />
                                    <p class="text-[11px] text-surface-500 mt-1.5 leading-tight">
                                        Isi nomor faktur fisik dari supplier. Biarkan kosong jika ingin sistem membuatkan nomor PO otomatis.
                                    </p>
                                </div>
                                
                                <div class="p-4 bg-surface-50 border border-surface-200 rounded-xl shadow-sm flex flex-col justify-center">
                                    <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Pilih Supplier <span class="text-red-500" v-if="isCreditSale">*</span></label>
                                    <Dropdown v-model="transactionMeta.supplierUuid" :options="suppliers" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Supplier..." class="w-full !text-sm" showClear />
                                    <p class="text-[11px] text-orange-500 mt-1.5 leading-tight font-medium" v-if="isCreditSale && !transactionMeta.supplierUuid">
                                        Supplier wajib diisi untuk pencatatan hutang.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <Divider type="dashed" class="!m-0 opacity-50" />

                        <section>
                            <h4 class="text-xs font-black text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="pi pi-credit-card"></i> Opsi Pembayaran</h4>
                            
                            <PaymentMethodSelector 
                                v-model="paymentData"
                                :grand-total="grandTotal"
                                type="buy"
                                :has-customer="!!transactionMeta.supplierUuid"
                            />
                        </section>

                    </div>
                </div>
            </div>

            <div class="px-6 md:px-8 py-5 border-t border-surface-200 bg-surface-50 shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.03)] z-10">
                <div class="flex flex-col sm:flex-row gap-4 justify-end items-center">
                    <Button label="Kembali Selesai" icon="pi pi-arrow-left" class="w-full sm:w-auto sm:w-36 font-bold !rounded-xl" severity="secondary" text @click="$emit('update:visible', false)" :disabled="processing" />
                    
                    <Button 
                        :label="isCreditSale ? 'Catat Hutang Pembelian' : 'Selesaikan Pembelian'" 
                        icon="pi pi-check"
                        class="w-full sm:w-auto sm:w-[280px] !h-14 !text-sm !font-bold !rounded-xl shadow-md transition-colors" 
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

input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>