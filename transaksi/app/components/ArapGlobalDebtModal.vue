<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

// [BARU] Define emits untuk memberi tahu parent ketika transaksi sukses
const emit = defineEmits(['saved']);

const journalService = useJournalService();
const toast = useToast();

const activeDebtType = ref('piutang'); // 'piutang' (AR) atau 'hutang' (AP)
const processing = ref(false);

const transaction = reactive({
    amount: null,
    contactName: '', // Pelanggan untuk Piutang, Supplier untuk Hutang
    dueDate: null,
    notes: '',
});

const canSave = computed(() => {
    // Validasi dasar: jumlah harus > 0, nama kontak, dan tanggal jatuh tempo harus diisi
    return transaction.amount > 0 && !!transaction.contactName && !!transaction.dueDate && !processing.value;
});

const typeColor = computed(() => activeDebtType.value === 'piutang' ? 'emerald' : 'red');
const typeIcon = computed(() => activeDebtType.value === 'piutang' ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-left');


const processTransaction = async () => {
    if (!canSave.value) return;

    processing.value = true;
    try {
        const type = activeDebtType.value;
        const payload = {
            details: {
                amount: transaction.amount,
                // Pastikan format tanggal ke YYYY-MM-DD
                due_date: transaction.dueDate ? transaction.dueDate.toISOString().split('T')[0] : null, 
                notes: transaction.notes,
                // Kirim nama kontak sesuai tipe
                ...(type === 'piutang' ? { customer_name: transaction.contactName } : {}),
                ...(type === 'hutang' ? { supplier: transaction.contactName } : {}),
                is_credit: 'true',
            }
        };

        if (type === 'piutang') {
            await journalService.createArTransaction(payload);
        } else {
            await journalService.createApTransaction(payload);
        }

        toast.add({ 
            severity: 'success', 
            summary: `Catatan ${type === 'piutang' ? 'Piutang' : 'Hutang'} Sukses`, 
            detail: `Transaksi ${formatCurrency(transaction.amount)} telah dicatat.`, 
            life: 5000 
        });

        // [UPDATE] Emit event 'saved' agar modal ditutup oleh parent
        emit('saved');

    } catch (e) {
        console.error("Error creating global debt:", e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.data?.message || e.message || `Terjadi kesalahan saat mencatat ${activeDebtType.value}`, life: 3000 });
    } finally {
        processing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

// [UPDATE] Expose method dan computed properties yang dibutuhkan oleh parent (untuk tombol Simpan)
defineExpose({
    processTransaction,
    canSave,
    processing,
    activeDebtType
});
</script>

<template>
    <div 
        class="bg-white dark:bg-surface-900 overflow-hidden transition-colors duration-500 min-h-full"
        :class="[activeDebtType === 'piutang' ? 'border-emerald-300 dark:border-emerald-800' : 'border-red-300 dark:border-red-800']"
    >
        <div class="p-5 border-b border-surface-200 dark:border-surface-800 flex items-center gap-4"
             :class="[activeDebtType === 'piutang' ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-red-50/50 dark:bg-red-900/10']"
        >
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
                 :class="[activeDebtType === 'piutang' ? 'bg-emerald-600 shadow-emerald-700/50' : 'bg-red-600 shadow-red-700/50']"
            >
                <i :class="typeIcon"></i>
            </div>
            <div>
                <h2 class="font-bold text-xl text-surface-800 dark:text-surface-100">
                    Catat Transaksi {{ activeDebtType === 'piutang' ? 'Piutang' : 'Hutang' }} Global
                </h2>
                <p class="text-sm text-surface-500 mt-0.5">Penambahan saldo {{ activeDebtType === 'piutang' ? 'Piutang (AR)' : 'Hutang (AP)' }} baru.</p>
            </div>
        </div>
        
        <div class="p-5 space-y-6">
            
            <div class="field">
                <label class="font-semibold text-sm mb-2 block text-surface-600 dark:text-surface-400">Pilih Tipe Transaksi</label>
                <SelectButton 
                    v-model="activeDebtType" 
                    :options="[{label: 'Piutang (AR)', value: 'piutang'}, {label: 'Hutang (AP)', value: 'hutang'}]"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                    :pt="{ 
                        button: ({ context }) => ({ 
                            class: [
                                '!text-sm !py-2 !font-bold transition-all',
                                'hover:bg-surface-200 dark:hover:bg-surface-700',
                                context.active ? (activeDebtType === 'piutang' ? '!bg-emerald-600 !text-white' : '!bg-red-600 !text-white') : ''
                            ] 
                        }) 
                    }"
                />
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                
                <div class="field">
                    <label for="contactName" class="font-semibold text-sm text-surface-600 dark:text-surface-400">Nama Kontak <span class="text-red-500">*</span></label>
                    <InputText 
                        id="contactName" 
                        v-model="transaction.contactName" 
                        :placeholder="activeDebtType === 'piutang' ? 'Cth: Bpk. Ujang Debitur' : 'Cth: PT. Supplier Cepat'"
                        class="w-full !py-2.5 !text-sm" 
                    />
                </div>

                <div class="field">
                    <label for="amount" class="font-semibold text-sm text-surface-600 dark:text-surface-400">Jumlah Nominal <span class="text-red-500">*</span></label>
                    <InputNumber 
                        id="amount" 
                        v-model="transaction.amount" 
                        mode="currency" 
                        currency="IDR" 
                        locale="id-ID" 
                        :min="0"
                        placeholder="0"
                        inputClass="!text-lg !font-mono !py-2.5"
                    />
                </div>

                <div class="field">
                    <label for="dueDate" class="font-semibold text-sm text-surface-600 dark:text-surface-400">Tanggal Jatuh Tempo <span class="text-red-500">*</span></label>
                    <Calendar 
                        id="dueDate" 
                        v-model="transaction.dueDate" 
                        dateFormat="dd/mm/yy" 
                        :minDate="new Date()" 
                        :manualInput="false" 
                        showIcon 
                        class="w-full" 
                        inputClass="!text-sm !py-2.5" 
                    />
                </div>
            </div>
            
            <div class="field">
                <label for="notes" class="font-semibold text-sm text-surface-600 dark:text-surface-400">Catatan (Opsional)</label>
                <Textarea v-model="transaction.notes" id="notes" rows="3" placeholder="Contoh: Dana Pinjaman Modal dari bank" class="w-full !text-sm" />
            </div>
            
        </div>
        
        </div>
</template>

<style scoped>
/* Menyesuaikan style SelectButton agar lebih dinamis dengan warna tab */
:deep(.p-selectbutton .p-button.p-highlight) {
    border-color: transparent !important; /* Hilangkan border highlight default */
}
</style>