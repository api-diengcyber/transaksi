<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useSupplierService } from '~/composables/useSupplierService';
// Asumsikan useJournalService di-import global lewat auto-import Nuxt
// Jika tidak, Anda harus import secara manual sesuai struktur project Anda

import PaymentMethodSelector from '~/components/payment/PaymentMethodSelector.vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const supplierService = useSupplierService();
const toast = useToast();

const processing = ref(false);
const suppliers = ref([]);

// 1. Inisialisasi state transaksi utama
const transaction = reactive({
    amount: null,
    supplierUuid: null,
    contactName: '',
    notes: '',
});

// 2. Inisialisasi state untuk dilempar ke PaymentMethodSelector
const paymentData = ref({
    paymentType: 'CREDIT', 
    cashAmount: 0,
    dueDate: null,
    paymentMethodUuid: null,
    paymentMethodCode: null
});

// Ambil data master supplier saat modal dipanggil
onMounted(async () => {
    try { 
        let sData = null;
        if (supplierService.getSuppliers) {
            sData = await supplierService.getSuppliers();
        } else if (supplierService.getAllSuppliers) {
            sData = await supplierService.getAllSuppliers();
        }
        suppliers.value = sData?.data?.data || sData?.data || sData || []; 
    } catch (e) {
        console.error('Gagal mengambil data supplier:', e);
    }
});

// Reset Form saat modal dibuka/ditutup
watch(() => props.visible, (newVal) => {
    if (newVal) {
        transaction.amount = null;
        transaction.supplierUuid = null;
        transaction.contactName = '';
        transaction.notes = '';
        
        paymentData.value = {
            paymentType: 'CREDIT', 
            cashAmount: 0,
            dueDate: null,
            paymentMethodUuid: null,
            paymentMethodCode: null
        };
        processing.value = false;
    }
});

// Pengecekan apakah Supplier (baik dari Dropdown maupun Manual Input) sudah terisi
const hasSupplier = computed(() => {
    // Memakai optional chaining '?.' supaya tidak error ketika contactName kosong
    return !!(transaction.supplierUuid || transaction.contactName?.trim());
});

// Perhitungan Sisa Hutang
const sisaHutang = computed(() => {
    const total = transaction.amount || 0;
    const dp = paymentData.value.cashAmount || 0;
    return total - dp;
});

// 3. LOGIKA VALIDASI (YANG MEMBUAT TOMBOL DISABLED/ENABLED)
const canSave = computed(() => {
    // Apakah transaksi ini murni hutang?
    const isCredit = paymentData.value.paymentType === 'CREDIT';
    
    // Syarat 1: Jika kredit, Wajib ada Due Date (Jatuh Tempo)
    const hasValidDueDate = !isCredit || (isCredit && !!paymentData.value.dueDate);
    
    // Syarat 2: Nominal DP tidak boleh minus dan tidak boleh lebih dari total tagihan
    const hasValidDP = paymentData.value.cashAmount >= 0 && paymentData.value.cashAmount <= (transaction.amount || 0);

    return transaction.amount > 0 && 
           sisaHutang.value >= 0 && 
           hasValidDP &&
           hasSupplier.value && 
           hasValidDueDate && 
           !processing.value;
});

const handleClose = () => emit('update:visible', false);

// 4. PROSES SIMPAN KE BACKEND
const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        // Tentukan nama supplier final (prioritas: Dropdown > Input Manual)
        let finalSuppName = 'Supplier Umum';
        if (transaction.supplierUuid) {
            finalSuppName = suppliers.value.find(s => s.uuid === transaction.supplierUuid)?.name || 'Supplier';
        } else if (transaction.contactName) {
            finalSuppName = transaction.contactName;
        }

        const payload = {
            details: {
                amount: transaction.amount,
                dp_amount: paymentData.value.cashAmount || 0,
                
                // Format Date yang aman untuk backend YYYY-MM-DD
                due_date: paymentData.value.dueDate ? new Date(paymentData.value.dueDate).toISOString().split('T')[0] : null, 
                
                notes: transaction.notes,
                
                // PERBAIKAN PENTING: Struktur data disesuaikan dengan JournalController AP
                supplier: finalSuppName, // Backend umumnya minta `supplier`, BUKAN `supplier_name`
                supplier_uuid: transaction.supplierUuid || null,
                
                is_credit: paymentData.value.paymentType === 'CREDIT' ? 'true' : 'false',
                payment_method_uuid: paymentData.value.paymentMethodUuid,
                payment_method_code: paymentData.value.paymentMethodCode
            }
        };

        // PERBAIKAN PENTING: Pengkondisian method pemanggilan API (mencegah error 'not a function')
        if (journalService.createApTransaction) {
            await journalService.createApTransaction(payload);
        } else if (journalService.createTransaction) {
             // Fallback apabila backend belum memecah routing API khusus AP
            await journalService.createTransaction({
                details: { ...payload.details, transaction_type: 'AP' }
            });
        } else {
             throw new Error("Method API (createApTransaction) tidak ditemukan di service!");
        }

        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Hutang manual berhasil dicatat.', life: 3000 });
        emit('saved'); 
        handleClose(); 
    } catch (e) {
        console.error("Gagal simpan AP:", e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.response?.data?.message || e.message || 'Terjadi kesalahan sistem', life: 3000 });
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
        class="w-full max-w-2xl m-4 !p-0"
        :pt="{ root: { class: '!border-0 !shadow-2xl' }, header: { class: 'hidden' }, content: { class: '!p-0 !rounded-xl' } }"
        dismissableMask
    >
        <div class="bg-surface-0 overflow-hidden flex flex-col max-h-[90vh]">
            <div class="flex justify-between items-center px-6 py-4 border-b border-surface-200 bg-surface-50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-rose-600 bg-rose-100 shadow-sm border border-rose-200">
                        <i class="pi pi-arrow-down-left text-lg font-bold"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg leading-tight">Catat Hutang (AP)</h3>
                        <span class="text-xs text-surface-500">Pencatatan saldo hutang manual ke supplier</span>
                    </div>
                </div>
                <button @click="handleClose" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition">
                    <i class="pi pi-times"></i>
                </button>
            </div>

            <div class="p-6 space-y-5 overflow-y-auto scrollbar-thin">
                
                <div class="flex gap-3">
                    <div class="flex-1">
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Data Supplier</label>
                        <Dropdown 
                            v-model="transaction.supplierUuid" 
                            :options="suppliers" 
                            optionLabel="name" 
                            optionValue="uuid" 
                            filter 
                            placeholder="Pilih Supplier..." 
                            class="w-full !text-sm" 
                            showClear 
                        />
                    </div>
                    <div class="flex-1" v-if="!transaction.supplierUuid">
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Supplier Baru (Manual)</label>
                        <InputText v-model="transaction.contactName" placeholder="Cth: PT Indofood..." class="w-full !text-sm" />
                    </div>
                </div>

                <div>
                    <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Total Hutang Baru <span class="text-rose-500">*</span></label>
                    <InputNumber 
                        v-model="transaction.amount" 
                        mode="currency" currency="IDR" locale="id-ID" 
                        placeholder="Rp 0" class="w-full" inputClass="!font-mono !font-bold !text-lg !py-3"
                    />
                </div>

                <div v-if="transaction.amount > 0" class="p-3 bg-rose-50 rounded-lg border border-rose-100 flex justify-between items-center transition-all">
                    <span class="text-xs font-bold text-rose-600 uppercase">Hutang Bersih:</span>
                    <span class="font-black text-xl font-mono text-rose-600">Rp {{ (sisaHutang < 0) ? '0' : sisaHutang.toLocaleString('id-ID') }}</span>
                </div>

                <div class="border-t border-surface-200 pt-5">
                    <PaymentMethodSelector 
                        v-model="paymentData" 
                        :grandTotal="transaction.amount || 0" 
                        type="buy" 
                        :hasCustomer="hasSupplier"
                    />
                </div>

                <div>
                    <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Catatan Tambahan</label>
                    <Textarea v-model="transaction.notes" rows="2" placeholder="Keterangan opsional..." class="w-full !text-sm resize-none focus:!border-rose-500 focus:!ring-rose-500" />
                </div>

            </div>

            <div class="p-4 border-t border-surface-200 bg-surface-50 flex gap-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                <Button label="Batal" class="flex-1 font-bold" severity="secondary" outlined @click="handleClose" />
                <Button 
                    label="Simpan Hutang" 
                    icon="pi pi-check" 
                    class="flex-[2] !h-11 !text-base !font-bold shadow-md" 
                    severity="danger" 
                    :loading="processing" 
                    :disabled="!canSave" 
                    @click="processTransaction" 
                />
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.5); border-radius: 20px; }
</style>