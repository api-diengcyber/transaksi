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
  members: { type: Array, required: true },
  users: { type: Array, required: true },
  transactionDate: { type: Date, required: true }
});

const emit = defineEmits(['update:visible', 'checkout-success']);

const authStore = useAuthStore();
const toast = useToast();
const journalService = useJournalService();

const processing = ref(false);

const transactionMeta = reactive({
  cashierUuid: authStore.user?.uuid || null,
  memberUuid: null,
  customerName: '', 
  manualInvoiceCode: ''
});

const paymentData = ref({
  paymentType: 'CASH', // 'CASH' atau 'CREDIT'
  paymentMethodUuid: null, // ID Rekening/Metode (misal BCA)
  paymentMethodCode: 'CASH', 
  cashAmount: 0, // Nominal uang yang diterima (baik untuk Lunas maupun DP)
  dueDate: null // Jatuh tempo khusus kredit
});

const isCreditSale = computed(() => paymentData.value.paymentType === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditSale.value) return 0;
    return paymentData.value.cashAmount - props.grandTotal;
});

const sisaPiutang = computed(() => {
    if (!isCreditSale.value) return 0;
    return props.grandTotal - (paymentData.value.cashAmount || 0);
});

const hasCustomer = computed(() => !!transactionMeta.memberUuid || transactionMeta.customerName.trim() !== '');

const canCheckout = computed(() => {
    if (props.cart.length === 0) return false;
    if (!transactionMeta.cashierUuid) return false;
    if (processing.value) return false;

    if (isCreditSale.value) {
        const isCustomerValid = hasCustomer.value;
        const isDueDateValid = !!paymentData.value.dueDate;
        const isDpValid = paymentData.value.cashAmount === 0 || !!paymentData.value.paymentMethodUuid;
        
        return isCustomerValid && isDueDateValid && isDpValid;
    } else {
        return paymentData.value.cashAmount >= props.grandTotal && !!paymentData.value.paymentMethodUuid;
    }
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    paymentData.value.paymentType = 'CASH';
    paymentData.value.cashAmount = props.grandTotal;
    paymentData.value.dueDate = null;
    paymentData.value.paymentMethodUuid = null; 
    
    // Reset manual code setiap kali modal dibuka
    transactionMeta.manualInvoiceCode = ''; 
  }
});

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const processCheckout = async (isPrint = false) => {
    if (!canCheckout.value) return;
    processing.value = true;

    try {
        let finalCustName = 'Umum';
        if (transactionMeta.memberUuid) {
            finalCustName = props.members.find(m => m.uuid === transactionMeta.memberUuid)?.name || 'Member';
        } else if (transactionMeta.customerName) {
            finalCustName = transactionMeta.customerName;
        }

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
            price_tier_name: item.activeTierName || 'Manual',
            hpp_method: item.hppMethod,
            tax_percentage: item.saleTaxPercentage,
            tax_amount: (item.price * item.qty) * (item.saleTaxPercentage / 100),
            stok_product_uuid: item.productUuid,
            stok_variant_uuid: item.variantUuid || null,
            stok_unit: item.unitUuid,
            stok_qty_min: item.qty, 
            stok_shelve_uuid: item.shelveUuid, 
            shelve_uuid: item.shelveUuid 
        }));

        let catatan = '';
        if (isCreditSale.value) {
            catatan = paymentData.value.cashAmount > 0 
                ? `Piutang (Kredit) - DP: ${formatCurrency(paymentData.value.cashAmount)} via ${paymentData.value.paymentMethodCode}`
                : `Piutang (Kredit) Penuh`;
        } else {
            catatan = remainingBalance.value > 0 
                ? `Lunas via ${paymentData.value.paymentMethodCode}: ${formatCurrency(paymentData.value.cashAmount)} | Kembali: ${formatCurrency(remainingBalance.value)}` 
                : `Lunas Uang Pas via ${paymentData.value.paymentMethodCode}`;
        }

        const payload = {
            grand_total: props.grandTotal,
            total_items: props.cart.length,
            payment_method: paymentData.value.paymentMethodCode || 'CASH',
            customer_name: finalCustName,
            notes: catatan,
            status: isCreditSale.value ? 'PENDING' : 'COMPLETED',
            amount_cash: paymentData.value.cashAmount,
            transaction_date: props.transactionDate ? props.transactionDate.toISOString() : new Date().toISOString(),
            cashier_uuid: transactionMeta.cashierUuid, 
            
            // [REVISI] Hanya mengirimkan jika pengguna mengetikkan nomor manual
            ...(transactionMeta.manualInvoiceCode.trim() && { custom_journal_code: transactionMeta.manualInvoiceCode.trim() }),

            ...(isCreditSale.value && {
                is_credit: 'true',
                due_date: paymentData.value.dueDate ? paymentData.value.dueDate.toISOString().split('T')[0] : null
            }),
            amount_credit: isCreditSale.value ? props.grandTotal : 0, 
            amount_installment: 0, 
            amount_bank_total: 0,
            shipping_cost: 0, 
            courier_uuid: null,
            member_uuid: transactionMeta.memberUuid || null, 
            target_store_uuid: null,
            items: itemsPayload
        };

        const response = await journalService.createSaleTransaction(payload);
        const transactionUuid = response?.data?.journal?.uuid || response?.journal?.uuid;
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Transaksi Berhasil Disimpan', life: 3000 });
        emit('checkout-success'); 
        emit('update:visible', false);

        if (isPrint && transactionUuid) {
            const printWindow = window.open(`/#/receipt/${transactionUuid}`, '_blank');
            if (!printWindow) {
                const printWindow2 = window.open(`/receipt/${transactionUuid}`, '_blank');
                if (!printWindow2) toast.add({ severity: 'warn', summary: 'Popup Diblokir', detail: 'Nota gagal terbuka.', life: 6000 });
            }
        }

        transactionMeta.customerName = '';
        transactionMeta.memberUuid = null;

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
                    <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 shadow-inner">
                        <i class="pi pi-wallet text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-xl text-surface-800 leading-tight tracking-tight">Selesaikan Pembayaran</h3>
                        <p class="text-xs text-surface-500 font-medium mt-0.5">Lengkapi data transaksi dan pilih metode pembayaran</p>
                    </div>
                </div>
                <button @click="$emit('update:visible', false)" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-red-100 hover:text-red-500 text-surface-600 transition-colors"><i class="pi pi-times font-bold"></i></button>
            </div>

            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div class="w-full lg:w-[40%] bg-surface-50 border-r border-surface-200 flex flex-col shrink-0">
                    <div class="p-6 md:p-8 flex-1 flex flex-col">
                        
                        <div class="bg-primary-600 text-white rounded-3xl p-6 shadow-lg shadow-primary-500/30 relative overflow-hidden flex flex-col items-center justify-center text-center h-56 mb-8 border border-primary-500">
                            <div class="absolute inset-0 bg-gradient-to-br from-primary-500/50 to-primary-800/50"></div>
                            <i class="pi pi-money-bill absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
                            
                            <span class="text-xs uppercase font-black tracking-widest text-primary-200 mb-2 relative z-10 drop-shadow-sm">Total Tagihan</span>
                            <div class="text-5xl font-black text-white drop-shadow-md relative z-10">{{ formatCurrency(grandTotal) }}</div>
                        </div>

                        <div class="flex-1 flex flex-col justify-end space-y-5 px-2">
                            <div class="flex justify-between items-center pb-5 border-b border-surface-200 border-dashed" v-if="!isCreditSale">
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-surface-500 uppercase tracking-wider">
                                        {{ remainingBalance < 0 ? 'Kekurangan Pembayaran' : 'Uang Kembalian' }}
                                    </span>
                                </div>
                                <span class="text-3xl font-black font-mono" :class="remainingBalance < 0 ? 'text-red-500' : 'text-emerald-500'">
                                    {{ formatCurrency(Math.abs(remainingBalance)) }}
                                </span>
                            </div>
                            
                            <div class="flex justify-between items-center pb-5 border-b border-surface-200 border-dashed" v-else>
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-orange-600 uppercase tracking-wider">Sisa Piutang</span>
                                    <span class="text-[10px] text-surface-400 font-medium">Setelah dikurangi Uang Muka (DP)</span>
                                </div>
                                <span class="text-3xl font-black font-mono text-orange-600">{{ formatCurrency(sisaPiutang) }}</span>
                            </div>

                            <div class="flex justify-between items-center bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                                <div class="flex items-center gap-3">
                                    <i class="pi pi-shopping-cart text-surface-400"></i>
                                    <span class="text-sm font-bold text-surface-600">Total Item Dibeli</span>
                                </div>
                                <span class="text-lg font-black text-surface-800 bg-surface-100 px-3 py-1 rounded-lg">{{ cart.length }} Item</span>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="w-full lg:w-[60%] flex flex-col flex-1 overflow-y-auto scrollbar-thin bg-surface-0">
                    <div class="p-6 md:p-8 space-y-8">
                        
                        <section>
                            <h4 class="text-xs font-black text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i class="pi pi-receipt"></i> Data Transaksi
                            </h4>
                            
                            <div class="flex flex-col gap-4">
                                
                                <div class="p-4 bg-surface-50 border border-surface-200 rounded-xl shadow-sm">
                                    <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">No. Faktur / Invoice</label>
                                    <InputText 
                                        v-model="transactionMeta.manualInvoiceCode" 
                                        placeholder="Kosongkan untuk otomatis" 
                                        class="w-full !text-sm font-mono font-bold" 
                                    />
                                    <p class="text-[11px] text-surface-500 mt-1.5 leading-tight">
                                        Isi hanya jika ingin menggunakan nomor faktur manual.
                                    </p>
                                </div>
                                
                                <div class="p-4 bg-surface-50 border border-surface-200 rounded-xl shadow-sm flex flex-col justify-center">
                                    <div class="flex flex-col sm:flex-row gap-4 h-full">
                                        <div class="flex-1">
                                            <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Pilih Member</label>
                                            <Dropdown 
                                                v-model="transactionMeta.memberUuid" 
                                                :options="members" 
                                                optionLabel="name" 
                                                optionValue="uuid" 
                                                filter 
                                                placeholder="Cari Member..." 
                                                class="w-full !text-sm" 
                                                showClear 
                                            />
                                        </div>
                                        <div class="flex-1" v-if="!transactionMeta.memberUuid">
                                            <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Atau Nama Umum</label>
                                            <InputText 
                                                v-model="transactionMeta.customerName" 
                                                placeholder="Contoh: Bapak Budi" 
                                                class="w-full !text-sm" 
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </section>

                        <Divider type="dashed" class="!m-0 opacity-50" />

                        <section>
                            <h4 class="text-xs font-black text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i class="pi pi-credit-card"></i> Opsi Pembayaran</h4>
                            
                            <PaymentMethodSelector 
                                v-model="paymentData"
                                :grand-total="grandTotal"
                                type="sale"
                                :has-customer="hasCustomer"
                            />
                        </section>

                    </div>
                </div>
            </div>

            <div class="px-6 md:px-8 py-5 border-t border-surface-200 bg-surface-50 shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.03)] z-10">
                <div class="flex flex-col sm:flex-row gap-4 justify-end items-center">
                    <Button label="Batal Selesai" icon="pi pi-times" class="w-full sm:w-auto sm:w-36 font-bold !rounded-xl" severity="secondary" text @click="$emit('update:visible', false)" :disabled="processing" />
                    
                    <div class="flex-1 w-full sm:w-auto flex flex-col sm:flex-row gap-3 justify-end">
                        <Button 
                            :label="isCreditSale ? 'Simpan Data Piutang' : 'Bayar Tanpa Nota'" 
                            class="flex-1 max-w-[200px] !h-14 !text-sm !font-bold !rounded-xl shadow-sm transition-colors" 
                            :severity="isCreditSale ? 'warning' : 'success'" outlined
                            :loading="processing" 
                            :disabled="!canCheckout" 
                            @click="processCheckout(false)" 
                        />
                        <Button 
                            :label="isCreditSale ? 'Simpan & Cetak Faktur' : 'Bayar & Cetak Struk'" 
                            icon="pi pi-print" 
                            class="flex-[1.5] max-w-[280px] !h-14 !text-sm !font-bold !rounded-xl shadow-md transition-colors" 
                            :severity="isCreditSale ? 'warning' : 'success'" 
                            :loading="processing" 
                            :disabled="!canCheckout" 
                            @click="processCheckout(true)" 
                        />
                    </div>
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

.animate-fade-in-down { animation: fadeInDown 0.2s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
/* input[type=number] { -moz-appearance: textfield; } */
</style>