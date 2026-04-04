<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useSupplierService } from '~/composables/useSupplierService'; // <-- IMPORT SUPPLIER SERVICE

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
const suppliers = ref([]); // State list supplier

const transaction = reactive({
    amount: null,
    dpAmount: null, // Tambahan state DP
    supplierUuid: null, // Tambahan dropdown supplier
    contactName: '',
    dueDate: null,
    notes: '',
});

// Load data supplier saat komponen di-mount
onMounted(async () => {
    try { 
        // Mengakomodasi perbedaan nama fungsi jika ada (getSuppliers / getAllSuppliers)
        const sData = supplierService.getAllSuppliers ? await supplierService.getAllSuppliers() : await supplierService.getSuppliers();
        suppliers.value = sData?.data?.data || sData?.data || sData || []; 
    } catch (e) {
        console.error('Gagal mengambil data supplier:', e);
    }
});

// Reset form saat modal dibuka
watch(() => props.visible, (newVal) => {
    if (newVal) {
        transaction.amount = null;
        transaction.dpAmount = null;
        transaction.supplierUuid = null;
        transaction.contactName = '';
        transaction.dueDate = null;
        transaction.notes = '';
        processing.value = false;
    }
});

const sisaHutang = computed(() => {
    const total = transaction.amount || 0;
    const dp = transaction.dpAmount || 0;
    return total - dp;
});

const canSave = computed(() => {
    const hasSupplier = transaction.supplierUuid || transaction.contactName.trim();
    return transaction.amount > 0 && sisaHutang.value >= 0 && !!hasSupplier && !!transaction.dueDate && !processing.value;
});

const handleClose = () => {
    emit('update:visible', false);
};

const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        let finalSupplierName = 'Umum';
        if (transaction.supplierUuid) {
            finalSupplierName = suppliers.value.find(s => s.uuid === transaction.supplierUuid)?.name || 'Supplier';
        } else if (transaction.contactName) {
            finalSupplierName = transaction.contactName;
        }

        const payload = {
            details: {
                amount: transaction.amount,
                dp_amount: transaction.dpAmount || 0, // Mengirim DP ke API
                due_date: transaction.dueDate ? transaction.dueDate.toISOString().split('T')[0] : null, 
                notes: transaction.notes,
                supplier: finalSupplierName, // AP menggunakan key 'supplier'
                supplier_uuid: transaction.supplierUuid || null,
                is_credit: 'true',
            }
        };

        await journalService.createApTransaction(payload);

        toast.add({ 
            severity: 'success', 
            summary: 'Berhasil', 
            detail: 'Transaksi Hutang berhasil dicatat.', 
            life: 3000 
        });

        emit('saved'); 
        handleClose(); 

    } catch (e) {
        console.error("Error creating AP:", e);
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
                        <span class="text-xs text-surface-500">Pencatatan hutang usaha ke supplier/vendor</span>
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
                            optionLabel="username" 
                            optionValue="uuid" 
                            filter 
                            placeholder="Pilih Supplier..." 
                            class="w-full !text-sm" 
                            showClear 
                        />
                    </div>
                    <div class="flex-1" v-if="!transaction.supplierUuid">
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Supplier Umum (Manual)</label>
                        <InputText 
                            v-model="transaction.contactName" 
                            placeholder="Cth: PT Makmur Jaya" 
                            class="w-full !text-sm" 
                        />
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Total Tagihan (Hutang) <span class="text-red-500">*</span></label>
                        <InputNumber 
                            v-model="transaction.amount" 
                            mode="currency" 
                            currency="IDR" 
                            locale="id-ID" 
                            placeholder="Rp 0"
                            class="w-full"
                            inputClass="!font-mono !font-bold"
                        />
                    </div>

                    <div>
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Uang Muka (DP)</label>
                        <InputNumber 
                            v-model="transaction.dpAmount" 
                            mode="currency" 
                            currency="IDR" 
                            locale="id-ID" 
                            placeholder="Rp 0"
                            class="w-full"
                            inputClass="!font-mono text-rose-600"
                        />
                    </div>
                </div>

                <div v-if="transaction.amount > 0" class="p-3 bg-red-50 rounded-lg border border-red-100 flex justify-between items-center">
                    <span class="text-xs font-bold text-red-600 uppercase">Sisa Kewajiban Bersih:</span>
                    <span class="font-black text-lg font-mono text-red-600">{{ (sisaHutang < 0) ? '0' : sisaHutang.toLocaleString('id-ID') }}</span>
                </div>

                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Jatuh Tempo <span class="text-red-500">*</span></label>
                         <Calendar 
                            v-model="transaction.dueDate" 
                            dateFormat="dd/mm/yy" 
                            :minDate="new Date()" 
                            showIcon 
                            class="w-full" 
                            inputClass="!text-sm"
                            placeholder="Pilih Tanggal Jatuh Tempo"
                        />
                    </div>

                    <div>
                        <label class="text-xs font-bold text-surface-500 uppercase mb-1 block">Catatan Tambahan</label>
                        <Textarea v-model="transaction.notes" rows="2" placeholder="Keterangan opsional..." class="w-full !text-sm resize-none" />
                    </div>
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