<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useMemberService } from '~/composables/useMemberService';

// Import komponen PaymentMethodSelector
import PaymentMethodSelector from '~/components/payment/PaymentMethodSelector.vue';

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:visible', 'saved']);

const journalService = useJournalService();
const memberService = useMemberService();
const toast = useToast();

const processing = ref(false);
const members = ref([]);

// State utama transaksi (di luar pengaturan pembayaran/DP)
const transaction = reactive({
    invoiceCode: '', // [BARU] Field untuk nomor faktur kustom
    amount: null,
    memberUuid: null,
    contactName: '',
    notes: '',
});

// State khusus untuk dikirimkan dan disinkronisasikan ke PaymentMethodSelector
const paymentData = ref({
    paymentType: 'CREDIT', // Karena ini Form Piutang, defaultnya Kredit
    cashAmount: 0,         // Nominal DP atau Pembayaran Masuk
    dueDate: null,         // Tanggal Jatuh Tempo
    paymentMethodUuid: null,
    paymentMethodCode: null
});

// Load data member saat komponen di-mount
onMounted(async () => {
    try { 
        const mData = await memberService.getMembers(); 
        members.value = mData?.data?.data || mData?.data || mData || []; 
    } catch (e) {
        console.error('Gagal mengambil data member:', e);
    }
});

// Reset form saat modal dibuka/ditutup
watch(() => props.visible, (newVal) => {
    if (newVal) {
        transaction.invoiceCode = ''; // [BARU] Reset nomor faktur
        transaction.amount = null;
        transaction.memberUuid = null;
        transaction.contactName = '';
        transaction.notes = '';
        
        // Kembalikan payment state ke default tiap buka modal
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

// Deteksi jika sudah ada identitas pelanggan yang dipilih (Member / Umum)
const hasCustomer = computed(() => {
    return !!(transaction.memberUuid || transaction.contactName.trim());
});

const sisaPiutang = computed(() => {
    const total = transaction.amount || 0;
    const dp = paymentData.value.cashAmount || 0;
    return total - dp;
});

const canSave = computed(() => {
    // Validasi tambahan terkait pembayaran
    const isCredit = paymentData.value.paymentType === 'CREDIT';
    const hasValidDueDate = !isCredit || (isCredit && !!paymentData.value.dueDate);
    const hasValidDP = paymentData.value.cashAmount >= 0 && paymentData.value.cashAmount <= (transaction.amount || 0);

    return transaction.amount > 0 && 
           sisaPiutang.value >= 0 && 
           hasValidDP &&
           hasCustomer.value && 
           hasValidDueDate && 
           !processing.value;
});

const handleClose = () => {
    emit('update:visible', false);
};

const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        let finalCustName = 'Umum';
        if (transaction.memberUuid) {
            finalCustName = members.value.find(m => m.uuid === transaction.memberUuid)?.name || 'Member';
        } else if (transaction.contactName) {
            finalCustName = transaction.contactName;
        }

        const payload = {
            // [BARU] Menyisipkan Nomor Faktur Kustom ke Backend
            custom_journal_code: transaction.invoiceCode || undefined,
            details: {
                amount: transaction.amount,
                dp_amount: paymentData.value.cashAmount || 0,
                due_date: paymentData.value.dueDate ? new Date(paymentData.value.dueDate).toISOString().split('T')[0] : null, 
                notes: transaction.notes,
                customer_name: finalCustName,
                member_uuid: transaction.memberUuid || null,
                is_credit: paymentData.value.paymentType === 'CREDIT' ? 'true' : 'false',
                
                // Meneruskan UUID metode jika DP diberikan melalui metode tertentu
                payment_method_uuid: paymentData.value.paymentMethodUuid,
                payment_method_code: paymentData.value.paymentMethodCode
            }
        };

        await journalService.createArTransaction(payload);

        toast.add({ 
            severity: 'danger', 
            summary: 'Berhasil', 
            detail: 'Transaksi Piutang berhasil dicatat.', 
            life: 3000 
        });

        emit('saved'); 
        handleClose(); 

    } catch (e) {
        console.error("Error creating AR:", e);
        // Menampilkan pesan error dari backend (seperti error nomor nota duplikat)
        const errorMessage = e.response?.data?.message || e.message || 'Terjadi kesalahan';
        toast.add({ severity: 'error', summary: 'Gagal Menyimpan', detail: errorMessage, life: 5000 });
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
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-red-600 bg-red-100 shadow-sm border border-red-200">
                        <i class="pi pi-arrow-up-right text-lg font-bold"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg leading-tight">Catat Piutang (AR)</h3>
                        <span class="text-xs text-surface-500">Pencatatan saldo piutang manual pelanggan</span>
                    </div>
                </div>
                <button @click="handleClose" class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-200 hover:bg-surface-300 text-surface-600 transition">
                    <i class="pi pi-times"></i>
                </button>
            </div>

            <div class="p-6 space-y-5 overflow-y-auto scrollbar-thin">
                
                <div class="bg-surface-50 p-4 border border-surface-200 rounded-lg">
                    <label class="text-xs font-bold text-surface-600 uppercase mb-1 block">Nomor Faktur / Invoice</label>
                    <InputText 
                        v-model="transaction.invoiceCode" 
                        placeholder="Biarkan kosong untuk penomoran otomatis" 
                        class="w-full !text-sm uppercase font-mono" 
                    />
                    <p class="text-[11px] text-surface-500 mt-1.5 leading-tight">
                        Masukkan nomor faktur sesuai preferensi Anda. Jika dikosongkan, sistem akan otomatis menggunakan kode AR-xxxx.
                    </p>
                </div>

                <div class="flex gap-3">
                    <div class="flex-1">
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Member</label>
                        <Dropdown 
                            v-model="transaction.memberUuid" 
                            :options="members" 
                            optionLabel="name" 
                            optionValue="uuid" 
                            filter 
                            placeholder="Pilih Member..." 
                            class="w-full !text-sm" 
                            showClear 
                        />
                    </div>
                    <div class="flex-1" v-if="!transaction.memberUuid">
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Pelanggan Umum (Manual)</label>
                        <InputText 
                            v-model="transaction.contactName" 
                            placeholder="Cth: Bapak Budi" 
                            class="w-full !text-sm" 
                        />
                    </div>
                </div>

                <div>
                    <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Total Tagihan (Piutang Keseluruhan) <span class="text-red-500">*</span></label>
                    <InputNumber 
                        v-model="transaction.amount" 
                        mode="currency" 
                        currency="IDR" 
                        locale="id-ID" 
                        placeholder="Rp 0"
                        class="w-full"
                        inputClass="!font-mono !font-bold !text-lg !py-3"
                    />
                </div>

                <div v-if="transaction.amount > 0" class="p-3 bg-red-50 rounded-lg border border-red-100 flex justify-between items-center transition-all">
                    <span class="text-xs font-bold text-red-600 uppercase">Sisa Piutang Bersih:</span>
                    <span class="font-black text-xl font-mono text-red-600">Rp {{ (sisaPiutang < 0) ? '0' : sisaPiutang.toLocaleString('id-ID') }}</span>
                </div>

                <div class="border-t border-surface-200 pt-5">
                    <PaymentMethodSelector 
                        v-model="paymentData" 
                        :grandTotal="transaction.amount || 0" 
                        type="sale" 
                        :hasCustomer="hasCustomer"
                    />
                </div>

                <div>
                    <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Catatan Tambahan</label>
                    <Textarea v-model="transaction.notes" rows="2" placeholder="Keterangan opsional..." class="w-full !text-sm resize-none" />
                </div>

            </div>

            <div class="p-4 border-t border-surface-200 bg-surface-50 flex gap-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
                <Button label="Batal" class="flex-1 font-bold" severity="secondary" outlined @click="handleClose" />
                <Button 
                    label="Simpan Tagihan" 
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