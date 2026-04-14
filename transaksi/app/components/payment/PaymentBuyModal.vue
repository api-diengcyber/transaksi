<script setup>
import { ref, computed, watch, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useJournalService } from '~/composables/useJournalService';

const props = defineProps({
  visible: { type: Boolean, required: true },
  cart: { type: Array, required: true },
  grandTotal: { type: Number, required: true },
  suppliers: { type: Array, required: true }
});

const emit = defineEmits(['update:visible', 'purchase-success']);

const authStore = useAuthStore();
const toast = useToast();
const journalService = useJournalService();

const processing = ref(false);
const cashAmount = ref(0);

// State Transaksi Khusus Pembayaran
const purchaseInfo = reactive({
    transactionDate: new Date(), 
    cashierUuid: authStore.user?.uuid || null,
    referenceNo: '', 
    notes: '',
    paymentMethod: 'CASH',
    dueDate: null,
    manualInvoiceCode: ''
});

// Computed Settings
const invoiceType = computed(() => authStore.getSetting('purchase_invoice_number_type', 'system'));
const isManualInvoice = computed(() => invoiceType.value === 'manual');
const isCreditPurchase = computed(() => purchaseInfo.paymentMethod === 'CREDIT');

const remainingBalance = computed(() => {
    if (isCreditPurchase.value) return 0;
    return cashAmount.value - props.grandTotal;
});

const canCheckout = computed(() => {
    if (props.cart.length === 0 || props.grandTotal <= 0) return false;
    if (!purchaseInfo.cashierUuid) return false; 
    if (processing.value) return false;
    
    if (isManualInvoice.value && !purchaseInfo.manualInvoiceCode.trim()) return false;

    if (isCreditPurchase.value) {
        return purchaseInfo.dueDate !== null; 
    } else {
        return cashAmount.value >= props.grandTotal; 
    }
});

const canProcessTransaction = computed(() => !processing.value);

// Watcher untuk sinkronisasi Visibility & Data Awal
watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (purchaseInfo.paymentMethod === 'CASH') {
        cashAmount.value = props.grandTotal;
    }
    if (!isManualInvoice.value && invoiceType.value !== 'system') {
        purchaseInfo.manualInvoiceCode = generatePurchaseInvoiceNumber();
    }
    
    if (!purchaseInfo.cashierUuid && authStore.user?.uuid) {
        purchaseInfo.cashierUuid = authStore.user.uuid;
    }
  }
});

watch(() => purchaseInfo.paymentMethod, (newMethod) => {
    if (newMethod === 'CASH') {
        cashAmount.value = props.grandTotal;
    } else {
        cashAmount.value = 0; 
    }
});

watch(() => props.grandTotal, (newTotal) => {
    if (purchaseInfo.paymentMethod === 'CASH' && props.visible) {
        cashAmount.value = newTotal;
    }
});

const generatePurchaseInvoiceNumber = () => {
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

const processPurchase = async () => {
    if (!canProcessTransaction.value || !canCheckout.value) return;

    processing.value = true;
    try {
        const uniqueSuppliers = [...new Set(props.cart.map(item => item.supplierUuid))];
        let globalSupplierName = 'Multi Supplier';
        if (uniqueSuppliers.length === 1 && uniqueSuppliers[0]) {
            const sup = props.suppliers.find(s => s.uuid === uniqueSuppliers[0]);
            if (sup) globalSupplierName = sup.name || sup.name || 'Unknown';
        }

        const itemsPayload = props.cart.map(item => {
            const sup = props.suppliers.find(s => s.uuid === item.supplierUuid);
            return {
                product_uuid: item.productUuid,
                variant_uuid: item.variantUuid || null, 
                unit_uuid: item.unitUuid,
                qty: item.qty,
                buy_price: item.buyPrice,
                subtotal: item.qty * item.buyPrice,
                item_name: item.name,
                unit_name: item.unitName,
                
                supplier_uuid: item.supplierUuid, 
                supplier_name: sup ? (sup.name || sup.name) : 'Unknown', 
                warehouse_uuid: item.warehouseUuid,

                stok_product_uuid: item.productUuid,
                stok_variant_uuid: item.variantUuid || null,
                stok_unit: item.unitUuid,
                stok_qty_plus: item.qty, 
                stok_warehouse_uuid: item.warehouseUuid 
            }
        });

        const payload = {
            ...(invoiceType.value !== 'system' && { custom_journal_code: purchaseInfo.manualInvoiceCode }),

            details: {
                grand_total: props.grandTotal,
                supplier: globalSupplierName, 
                reference_no: purchaseInfo.referenceNo || '-', 
                notes: purchaseInfo.notes,
                payment_method: purchaseInfo.paymentMethod,
                
                transaction_date: purchaseInfo.transactionDate ? purchaseInfo.transactionDate.toISOString() : new Date().toISOString(),
                cashier_uuid: purchaseInfo.cashierUuid,

                is_credit: isCreditPurchase.value ? 'true' : 'false',
                due_date: purchaseInfo.dueDate ? purchaseInfo.dueDate.toISOString().split('T')[0] : null,
                amount_cash: cashAmount.value, 
                amount_credit: isCreditPurchase.value ? (props.grandTotal - cashAmount.value) : 0,
                total_items_count: props.cart.length,
                items: itemsPayload 
            }
        };

        await journalService.createBuyTransaction(payload);
        
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Pembelian Berhasil Disimpan', life: 3000 });
        
        // Reset Modal State
        purchaseInfo.referenceNo = '';
        purchaseInfo.notes = '';
        purchaseInfo.paymentMethod = 'CASH';
        purchaseInfo.dueDate = null;
        cashAmount.value = 0;
        
        emit('purchase-success');
        emit('update:visible', false);

    } catch (e) {
        console.error("Error processing purchase:", e);
        const errMsg = e.response?._data?.message || e.response?.data?.message || e.message || 'Transaksi gagal diproses';
        toast.add({ severity: 'error', summary: 'Gagal', detail: errMsg, life: 5000 });
    } finally {
        processing.value = false;
    }
};

const cancelModal = () => {
    emit('update:visible', false);
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" class="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm transition-all" :pt="{ root: { class: '!border-0 !shadow-2xl !bg-transparent' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-xl !bg-surface-0' } }" modal dismissableMask>
        <div class="bg-surface-0 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            
            <div class="flex justify-between items-center p-4 border-b border-surface-200 bg-surface-50">
                <h3 class="font-bold text-lg">Penyelesaian Pembelian</h3>
                <button @click="cancelModal" class="text-surface-400 hover:text-surface-600 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-200">
                    <i class="pi pi-times"></i>
                </button>
            </div>

            <div class="p-5 overflow-y-auto scrollbar-thin space-y-4">
                
                <div class="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100 relative overflow-hidden">
                    <i class="pi pi-shopping-bag absolute -right-4 -bottom-4 text-8xl opacity-10 text-emerald-500"></i>
                    <span class="text-xs uppercase text-surface-500 tracking-widest font-bold">Total Nilai Pembelian</span>
                    <div class="text-3xl font-black text-emerald-700 mt-1">
                        {{ formatCurrency(grandTotal) }}
                    </div>
                </div>

                <div class="space-y-4">
                    
                    <div class="p-3 bg-surface-100 border border-surface-200 rounded-xl mb-4" v-if="invoiceType !== 'system'">
                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Nomor PO / Faktur Internal</label>
                        
                        <InputText v-if="isManualInvoice" v-model="purchaseInfo.manualInvoiceCode" placeholder="Ketik No PO Manual..." class="w-full !text-sm font-mono font-bold border-emerald-200 focus:ring-emerald-500" />
                        
                        <div v-else class="flex justify-between items-center bg-white p-2 rounded border border-surface-200 font-mono font-bold text-emerald-700 text-sm">
                            <span>{{ purchaseInfo.manualInvoiceCode }}</span>
                            <Button icon="pi pi-refresh" text rounded size="small" class="!w-6 !h-6 !p-0" @click="purchaseInfo.manualInvoiceCode = generatePurchaseInvoiceNumber()" v-tooltip.top="'Generate Ulang'" />
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] uppercase font-bold text-surface-500 mb-1 block">Metode Pembayaran</label>
                        <SelectButton 
                            v-model="purchaseInfo.paymentMethod" 
                            :options="[{label:'Tunai Lunas', value:'CASH'}, {label:'Hutang (Kredit)', value:'CREDIT'}]" 
                            optionLabel="label" 
                            optionValue="value"
                            class="w-full flex"
                            :pt="{ button: { class: '!text-xs !py-2.5 flex-1' } }" 
                        />
                    </div>

                    <div v-if="isCreditPurchase" class="space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100 animate-fade-in-down">
                        <div>
                            <label class="text-xs font-bold text-orange-700 uppercase mb-1 block">Jatuh Tempo Pembayaran <span class="text-red-500">*</span></label>
                            <Calendar v-model="purchaseInfo.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full" inputClass="!text-sm" placeholder="Pilih Tanggal..." />
                        </div>
                    </div>

                    <div v-else class="space-y-3 pt-2 animate-fade-in-down">
                        <label class="text-xs font-bold text-surface-600 uppercase block">Nominal Tunai (Cash)</label>
                        <InputNumber 
                            v-model="cashAmount" 
                            mode="currency" 
                            currency="IDR" 
                            locale="id-ID" 
                            class="w-full" 
                            inputClass="!text-2xl !py-3 !font-black !text-center text-emerald-600 focus:!ring-emerald-500 focus:border-emerald-500" 
                        />
                    </div>

                    <div class="space-y-3 pt-2 border-t border-surface-100">
                        <div>
                            <label class="text-xs font-bold text-surface-500 uppercase block mb-1">Nota Fisik Supplier / Surat Jalan</label>
                            <InputText v-model="purchaseInfo.referenceNo" placeholder="Contoh: INV-SUP-001..." class="w-full !text-sm" />
                        </div>
                        <div>
                            <label class="text-xs font-bold text-surface-500 uppercase block mb-1">Catatan Tambahan</label>
                            <Textarea v-model="purchaseInfo.notes" rows="2" placeholder="Catatan opsional..." class="w-full !text-sm resize-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-surface-200 bg-surface-50 space-y-4">
                <div class="flex justify-between items-center px-2" v-if="!isCreditPurchase">
                    <span class="text-sm font-bold text-surface-600 uppercase tracking-wide">
                        {{ remainingBalance < 0 ? 'Kurang Bayar' : 'Kembalian' }}
                    </span>
                    <span class="text-2xl font-black font-mono" :class="remainingBalance < 0 ? 'text-red-500' : 'text-emerald-500'">
                        {{ formatCurrency(Math.abs(remainingBalance)) }}
                    </span>
                </div>
                
                <div class="flex justify-between items-center px-2" v-else>
                    <span class="text-sm font-bold text-orange-600 uppercase tracking-wide">
                        Total Hutang
                    </span>
                    <span class="text-2xl font-black font-mono text-orange-600">
                        {{ formatCurrency(grandTotal) }}
                    </span>
                </div>

                <div class="flex gap-3">
                    <Button label="Batal" class="flex-1" severity="secondary" outlined @click="cancelModal" />
                    <Button 
                        :label="isCreditPurchase ? 'Catat Hutang & Stok' : 'Simpan Lunas & Stok'" 
                        :icon="processing ? 'pi pi-spinner pi-spin' : 'pi pi-check'" 
                        class="flex-[2] font-bold"
                        :severity="isCreditPurchase ? 'warning' : 'success'"
                        :loading="processing" 
                        :disabled="!canProcessTransaction || !canCheckout"
                        @click="processPurchase"
                    />
                </div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 20px; }
.animate-fade-in-down { animation: fadeInDown 0.3s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>