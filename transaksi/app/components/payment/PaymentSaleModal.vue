<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useJournalService } from '~/composables/useJournalService';

const props = defineProps({
  visible: { type: Boolean, required: true },
  cart: { type: Array, required: true },
  grandTotal: { type: Number, required: true },
  members: { type: Array, required: true },
  users: { type: Array, required: true }
});

const emit = defineEmits(['update:visible', 'checkout-success']);

const authStore = useAuthStore();
const toast = useToast();
const journalService = useJournalService();

const processing = ref(false);
const cashAmount = ref(0);

// State Transaksi Khusus Pembayaran
const transactionMeta = reactive({
  transactionDate: new Date(),
  cashierUuid: authStore.user?.uuid || null,
  memberUuid: null,
  customerName: '', 
  paymentMethod: 'CASH',
  dueDate: null,
  manualInvoiceCode: ''
});

// Computed Settings
const invoiceType = computed(() => authStore.getSetting('invoice_number_type', 'system'));
const isManualInvoice = computed(() => invoiceType.value === 'manual');
const isCreditSale = computed(() => transactionMeta.paymentMethod === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditSale.value) return 0;
    return cashAmount.value - props.grandTotal;
});

const canCheckout = computed(() => {
    if (props.cart.length === 0) return false;
    if (!transactionMeta.cashierUuid) return false;
    if (processing.value) return false;
    
    if (isManualInvoice.value && !transactionMeta.manualInvoiceCode.trim()) return false;

    if (isCreditSale.value) {
        const hasCustomer = transactionMeta.memberUuid || transactionMeta.customerName.trim() !== '';
        return hasCustomer && transactionMeta.dueDate;
    } else {
        return cashAmount.value >= props.grandTotal;
    }
});

// Watcher untuk sinkronisasi Visibility & Data Awal
watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (transactionMeta.paymentMethod === 'CASH') {
        cashAmount.value = props.grandTotal;
    }
    if (!isManualInvoice.value && invoiceType.value !== 'system') {
        transactionMeta.manualInvoiceCode = generateInvoiceNumber();
    }
  }
});

watch(() => transactionMeta.paymentMethod, (newMethod) => {
    if (newMethod === 'CASH') {
        cashAmount.value = props.grandTotal;
    } else {
        cashAmount.value = 0; 
    }
});

const generateInvoiceNumber = () => {
    const type = invoiceType.value;
    if (type === 'system' || type === 'manual') return null;

    const prefix = String(authStore.getSetting('invoice_prefix') || 'INV-').toUpperCase();
    const suffix = String(authStore.getSetting('invoice_suffix') || '').toUpperCase();
    const length = Number(authStore.getSetting('invoice_length')) || 5;
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
            catatan = cashAmount.value > 0 
                ? `Piutang (Kredit) - DP: ${formatCurrency(cashAmount.value)}`
                : `Piutang (Kredit) Penuh`;
        } else {
            catatan = remainingBalance.value > 0 
                ? `Tunai: ${formatCurrency(cashAmount.value)} | Kembali: ${formatCurrency(remainingBalance.value)}` 
                : 'Pembayaran Uang Pas';
        }

        const payload = {
            grand_total: props.grandTotal,
            total_items: props.cart.length,
            payment_method: transactionMeta.paymentMethod,
            customer_name: finalCustName,
            notes: catatan,
            status: isCreditSale.value ? 'PENDING' : 'COMPLETED',
            amount_cash: cashAmount.value,
            transaction_date: transactionMeta.transactionDate ? transactionMeta.transactionDate.toISOString() : new Date().toISOString(),
            cashier_uuid: transactionMeta.cashierUuid, 
            
            ...(invoiceType.value !== 'system' && { custom_journal_code: transactionMeta.manualInvoiceCode }),

            ...(isCreditSale.value && {
                is_credit: 'true',
                due_date: transactionMeta.dueDate ? transactionMeta.dueDate.toISOString().split('T')[0] : null
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

        if (isPrint) {
            if (transactionUuid) {
                const printWindow = window.open(`/#/receipt/${transactionUuid}`, '_blank');
                if (!printWindow) {
                    const printWindow2 = window.open(`/receipt/${transactionUuid}`, '_blank');
                    if (!printWindow2) {
                        toast.add({ severity: 'warn', summary: 'Popup Diblokir', detail: 'Nota gagal terbuka. Izinkan Popup browser.', life: 6000 });
                    }
                }
            } else {
                toast.add({ severity: 'error', summary: 'Gagal Cetak', detail: 'Gagal mengambil ID struk.', life: 4000 });
            }
        }

        // Reset
        transactionMeta.customerName = '';
        transactionMeta.memberUuid = null;
        transactionMeta.dueDate = null;
        transactionMeta.paymentMethod = 'CASH';

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
    modal 
    dismissableMask
  >
        <div class="bg-surface-0 flex flex-col max-h-[95vh] rounded-2xl overflow-hidden relative">
            
            <div class="flex justify-between items-center px-6 py-5 border-b border-surface-200 bg-surface-50 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                        <i class="pi pi-wallet text-xl"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-xl text-surface-800 leading-tight">Selesaikan Pembayaran</h3>
                        <p class="text-xs text-surface-500 font-medium mt-0.5">Lengkapi data transaksi dan pilih metode pembayaran</p>
                    </div>
                </div>
                <button @click="$emit('update:visible', false)" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition"><i class="pi pi-times"></i></button>
            </div>

            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                
                <div class="w-full lg:w-[40%] bg-surface-50 border-r border-surface-200 flex flex-col shrink-0">
                    <div class="p-6 flex-1 flex flex-col justify-center">
                        <div class="bg-primary-600 text-white rounded-2xl p-6 shadow-lg shadow-primary-500/30 relative overflow-hidden flex flex-col items-center justify-center text-center h-48">
                            <i class="pi pi-money-bill absolute -right-6 -bottom-6 text-9xl opacity-10"></i>
                            <span class="text-sm uppercase font-bold tracking-widest text-primary-200 mb-2">Total Tagihan</span>
                            <div class="text-4xl md:text-5xl font-black text-white drop-shadow-md">{{ formatCurrency(grandTotal) }}</div>
                        </div>

                        <div class="mt-8 space-y-4 px-2">
                            <div class="flex justify-between items-center pb-4 border-b border-surface-200 border-dashed" v-if="!isCreditSale">
                                <span class="text-sm font-bold text-surface-500 uppercase tracking-wider">
                                    {{ remainingBalance < 0 ? 'Kurang Bayar' : 'Kembalian' }}
                                </span>
                                <span class="text-2xl font-black font-mono" :class="remainingBalance < 0 ? 'text-red-500' : 'text-emerald-500'">
                                    {{ formatCurrency(Math.abs(remainingBalance)) }}
                                </span>
                            </div>
                            
                            <div class="flex justify-between items-center pb-4 border-b border-surface-200 border-dashed" v-else>
                                <span class="text-sm font-bold text-orange-600 uppercase tracking-wider">Sisa Piutang Bersih</span>
                                <span class="text-2xl font-black font-mono text-orange-600">{{ formatCurrency(props.grandTotal - cashAmount) }}</span>
                            </div>

                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-surface-500">Jumlah Item</span>
                                <span class="text-sm font-bold text-surface-800">{{ cart.length }} Item</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-[60%] flex flex-col flex-1 overflow-y-auto scrollbar-thin bg-surface-0">
                    <div class="p-6 md:p-8 space-y-6">
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="p-3 bg-surface-50 border border-surface-200 rounded-xl" v-if="invoiceType !== 'system'">
                                <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">No. Faktur / Invoice</label>
                                <InputText v-if="isManualInvoice" v-model="transactionMeta.manualInvoiceCode" placeholder="Ketik No Faktur Manual..." class="w-full !text-sm font-mono font-bold" />
                                <div v-else class="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-surface-200 font-mono font-bold text-primary-700 text-sm shadow-sm">
                                    <span>{{ transactionMeta.manualInvoiceCode }}</span>
                                    <button class="text-surface-400 hover:text-primary-600 transition" @click="transactionMeta.manualInvoiceCode = generateInvoiceNumber()" v-tooltip.top="'Generate Ulang'"><i class="pi pi-refresh"></i></button>
                                </div>
                            </div>
                            
                            <div class="p-3 bg-surface-50 border border-surface-200 rounded-xl flex flex-col justify-center" :class="{'md:col-span-2': invoiceType === 'system'}">
                                <div class="flex gap-3 h-full">
                                    <div class="flex-1">
                                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Member</label>
                                        <Dropdown v-model="transactionMeta.memberUuid" :options="members" optionLabel="name" optionValue="uuid" filter placeholder="Pilih Member..." class="w-full !text-sm" showClear />
                                    </div>
                                    <div class="flex-1" v-if="!transactionMeta.memberUuid">
                                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-2 block">Pelanggan Umum</label>
                                        <InputText v-model="transactionMeta.customerName" placeholder="Contoh: Bapak Budi" class="w-full !text-sm" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Divider type="dashed" />

                        <div>
                            <label class="text-[11px] uppercase font-bold text-surface-500 mb-3 block">Tipe Pembayaran</label>
                            <SelectButton 
                                v-model="transactionMeta.paymentMethod" 
                                :options="[{label:'Tunai (Lunas)', value:'CASH'}, {label:'Piutang (Kredit)', value:'CREDIT'}]" 
                                optionLabel="label" 
                                optionValue="value"
                                class="w-full shadow-sm"
                                :pt="{ button: { class: '!text-sm !font-bold !py-3 flex-1' } }" 
                            />
                        </div>

                        <div class="bg-surface-50 p-5 rounded-2xl border border-surface-200">
                            
                            <div v-if="isCreditSale" class="space-y-5 animate-fade-in-down">
                                <div v-if="!transactionMeta.memberUuid && !transactionMeta.customerName.trim()" class="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2">
                                    <i class="pi pi-exclamation-triangle text-lg"></i> Nama Pelanggan wajib diisi untuk transaksi kredit.
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="text-xs font-bold text-orange-700 uppercase mb-2 block">Jatuh Tempo <span class="text-red-500">*</span></label>
                                        <Calendar v-model="transactionMeta.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full shadow-sm" inputClass="!text-sm" placeholder="Pilih Tanggal..." />
                                    </div>
                                    <div>
                                        <label class="text-xs font-bold text-surface-600 uppercase block mb-2">Uang Muka / DP</label>
                                        <InputNumber v-model="cashAmount" mode="currency" currency="IDR" locale="id-ID" class="w-full shadow-sm" :max="grandTotal" inputClass="!text-lg !font-black !py-2 !text-orange-600 focus:!ring-orange-500 focus:border-orange-500" />
                                    </div>
                                </div>
                            </div>

                            <div v-else class="space-y-4 animate-fade-in-down">
                                <label class="text-[11px] font-bold text-surface-500 uppercase block">Nominal Uang Tunai yang Diterima</label>
                                <InputNumber 
                                    v-model="cashAmount" 
                                    mode="currency" 
                                    currency="IDR" 
                                    locale="id-ID" 
                                    class="w-full shadow-sm" 
                                    inputClass="!text-3xl !py-4 !font-black !text-center text-emerald-600 focus:!ring-emerald-500 focus:border-emerald-500" 
                                    autofocus
                                />

                                <div class="grid grid-cols-4 gap-3 mt-4">
                                    <Button label="Uang Pas" outlined severity="success" size="small" class="!font-bold !py-2 shadow-sm bg-white" @click="cashAmount = grandTotal" />
                                    <Button label="20.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="cashAmount = 20000" />
                                    <Button label="50.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="cashAmount = 50000" />
                                    <Button label="100.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="cashAmount = 100000" />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 border-t border-surface-200 bg-surface-50 shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.03)] z-10">
                <div class="flex flex-col sm:flex-row gap-3 justify-end">
                    <Button label="Kembali" icon="pi pi-arrow-left" class="sm:w-32 font-bold !rounded-xl" severity="secondary" outlined @click="$emit('update:visible', false)" :disabled="processing" />
                    
                    <div class="flex-1 flex gap-3 justify-end">
                        <Button 
                            :label="isCreditSale ? 'Catat Tanpa Cetak' : 'Bayar Saja'" 
                            class="flex-1 max-w-xs !h-12 !text-sm !font-bold !rounded-xl shadow-sm transition-colors" 
                            :severity="isCreditSale ? 'warning' : 'success'" outlined
                            :loading="processing" 
                            :disabled="!canCheckout" 
                            @click="processCheckout(false)" 
                        />
                        <Button 
                            :label="isCreditSale ? 'Catat & Cetak Nota' : 'Bayar & Cetak Nota'" 
                            icon="pi pi-print" 
                            class="flex-[1.5] max-w-sm !h-12 !text-sm !font-bold !rounded-xl shadow-md transition-colors" 
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