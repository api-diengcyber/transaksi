<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useJournalService } from '~/composables/useJournalService';
import { useAccountService } from '~/composables/useAccountService';

interface Account { code: string; name: string; }

const props = defineProps({ visible: Boolean });
const emit = defineEmits(['update:visible', 'saved']);

const { createManual, getTemplates } = useJournalService();
const { getAll: getAllAccounts } = useAccountService();
const toast = useToast();

const isSubmitting = ref(false);
const masterAccounts = ref<Account[]>([]);
const journalTemplates = ref<any[]>([]);
const selectedTemplate = ref<any>(null);

const form = ref({ name: '', date: new Date(), note: '', saveAsTemplate: false });
const formEntries = ref<any[]>([
    { account: null, debit: 0, credit: 0 },
    { account: null, debit: 0, credit: 0 }
]);

const totalFormDebit = computed(() => formEntries.value.reduce((sum, e) => sum + (e.debit || 0), 0));
const totalFormCredit = computed(() => formEntries.value.reduce((sum, e) => sum + (e.credit || 0), 0));
const isFormBalanced = computed(() => totalFormDebit.value === totalFormCredit.value && totalFormDebit.value > 0);

const loadTemplatesApi = async () => {
    try {
        const res = await getTemplates() as any;
        journalTemplates.value = res || res?.data || [];
    } catch (e) {}
};

const fetchAccounts = async () => {
    if (masterAccounts.value.length === 0) {
        try {
            const res = await getAllAccounts() as any;
            masterAccounts.value = (res.data || res || []) as Account[];
        } catch(e) {}
    }
};

const applyTemplate = () => {
    if (!selectedTemplate.value) {
        // Reset ke mode custom manual
        formEntries.value = [{ account: null, debit: 0, credit: 0 }, { account: null, debit: 0, credit: 0 }];
        return;
    }
    
    const tpl = selectedTemplate.value;
    form.value.name = tpl.label;
    
    // Autofill akun berdasarkan config database
    formEntries.value = tpl.entries.map((e: any) => {
        const matchAcc = masterAccounts.value.find(acc => acc.code === e.code) || { code: e.code, name: e.name };
        return { 
            account: matchAcc, 
            debit: 0, // Dikosongkan agar kasir mengisi nominalnya
            credit: 0, 
            detailKey: e.detailKey, // Wajib disertakan agar ter-map ke config saat disimpan
            lockedPosition: e.position // Opsional: mengunci input di sisi debit/kredit sesuai config
        };
    });
};

const addRow = () => formEntries.value.push({ account: null, debit: 0, credit: 0 });
const removeRow = (idx: number) => formEntries.value.splice(idx, 1);
const close = () => emit('update:visible', false);

const submitJournal = async () => {
    if (!isFormBalanced.value) return;
    
    const invalidEntry = formEntries.value.find(e => !e.account);
    if (invalidEntry) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Ada baris yang belum dipilih akunnya.', life: 3000 });
        return;
    }

    if (form.value.saveAsTemplate && !form.value.name.trim()) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Nama Jurnal wajib diisi jika ingin menyimpannya sebagai template.', life: 3000 });
        return;
    }

    const payload = {
        date: form.value.date.toISOString(),
        note: form.value.name ? `[${form.value.name}] ${form.value.note}` : form.value.note,
        saveAsTemplate: form.value.saveAsTemplate,
        templateName: form.value.name.trim(),
        templateCode: selectedTemplate.value?.templateCode || null, // Kirim null jika ini jurnal custom baru
        entries: formEntries.value.map(e => ({
            accountUuid: e.account!.uuid, 
            accountCode: e.account!.code, 
            accountName: e.account!.name, 
            debit: e.debit, 
            credit: e.credit,
            detailKey: e.detailKey || undefined // Terisi otomatis jika pakai template
        }))
    };

    isSubmitting.value = true;
    try {
        await createManual(payload);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Jurnal Umum berhasil dicatat.', life: 3000 });
        if (form.value.saveAsTemplate) loadTemplatesApi();
        emit('saved');
        close();
    } catch (e: any) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.response?.data?.message || 'Terjadi kesalahan.', life: 4000 });
    } finally {
        isSubmitting.value = false;
    }
};

watch(() => props.visible, (newVal) => {
    if (newVal) {
        form.value = { name: '', date: new Date(), note: '', saveAsTemplate: false };
        formEntries.value = [{ account: null, debit: 0, credit: 0 }, { account: null, debit: 0, credit: 0 }];
        selectedTemplate.value = null;
        fetchAccounts();
        loadTemplatesApi();
    }
});

const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(val || 0);
onMounted(() => loadTemplatesApi());
</script>

<template>
    <Dialog :visible="visible" @update:visible="(val) => emit('update:visible', val)" header="Catat Jurnal Manual" :modal="true" :style="{ width: '850px' }" class="custom-dialog p-fluid">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Tanggal Transaksi</label>
                <DatePicker v-model="form.date" dateFormat="dd M yy" showIcon class="w-full shadow-sm" />
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Pilih Template (Opsional)</label>
                <Select v-model="selectedTemplate" :options="journalTemplates" optionLabel="label" placeholder="Custom / Buat Baru" class="w-full shadow-sm" @change="applyTemplate" showClear />
            </div>

            <div class="col-span-1 md:col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Judul Transaksi</label>
                <InputText v-model="form.name" placeholder="Contoh: Bayar Tagihan Listrik" class="w-full shadow-sm" />
            </div>
            <div class="col-span-1 md:col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Keterangan Detail</label>
                <InputText v-model="form.note" placeholder="Catatan tambahan..." class="w-full shadow-sm" />
            </div>

            <div v-if="!selectedTemplate" class="col-span-1 md:col-span-2 flex items-center gap-2 mt-1">
                <Checkbox v-model="form.saveAsTemplate" :binary="true" inputId="saveTemplateCheck" />
                <label for="saveTemplateCheck" class="text-sm font-medium text-slate-700 cursor-pointer">Simpan pengaturan akun di bawah ini sebagai Template Baru</label>
            </div>
        </div>

        <div class="border border-slate-200 rounded-xl overflow-hidden mb-2">
            <table class="w-full text-sm text-left">
                <thead class="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                    <tr>
                        <th class="px-5 py-3 w-[45%]">Kode & Nama Akun</th>
                        <th class="px-4 py-3 w-[22%] text-right">Debit (Rp)</th>
                        <th class="px-4 py-3 w-[22%] text-right">Kredit (Rp)</th>
                        <th class="px-2 py-3 text-center w-[11%]"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="(row, idx) in formEntries" :key="idx" class="bg-white hover:bg-slate-50 transition-colors">
                        <td class="p-3">
                            <Select v-model="row.account" :options="masterAccounts" optionLabel="name" filter placeholder="Cari Akun..." class="w-full border-slate-200" :disabled="!!selectedTemplate">
                                <template #value="slotProps">
                                    <div v-if="slotProps.value" class="flex gap-2 items-center">
                                        <span class="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded">{{ slotProps.value.code }}</span>
                                        <span class="text-sm truncate">{{ slotProps.value.name }}</span>
                                    </div>
                                    <span v-else class="text-slate-400">{{ slotProps.placeholder }}</span>
                                </template>
                                <template #option="slotProps">
                                    <div class="flex items-center gap-2 py-1">
                                        <span class="font-mono text-xs font-bold text-slate-500 w-12">{{ slotProps.option.code }}</span>
                                        <span class="text-sm">{{ slotProps.option.name }}</span>
                                    </div>
                                </template>
                            </Select>
                        </td>
                        <td class="p-3">
                            <InputNumber v-model="row.debit" mode="decimal" class="w-full text-right !font-mono" :min="0" :disabled="row.lockedPosition === 'CREDIT'" />
                        </td>
                        <td class="p-3">
                            <InputNumber v-model="row.credit" mode="decimal" class="w-full text-right !font-mono" :min="0" :disabled="row.lockedPosition === 'DEBIT'" />
                        </td>
                        <td class="p-3 text-center">
                            <button @click="removeRow(idx)" :disabled="formEntries.length <= 2 || !!selectedTemplate" class="w-8 h-8 rounded-lg flex items-center justify-center mx-auto text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors">
                                <i class="pi pi-times"></i>
                            </button>
                        </td>
                    </tr>
                </tbody>
                <tfoot class="bg-slate-50 border-t border-slate-200">
                    <tr>
                        <td class="px-5 py-4">
                            <button v-if="!selectedTemplate" @click="addRow" class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                <i class="pi pi-plus-circle"></i> Tambah Baris
                            </button>
                        </td>
                        <td class="px-4 py-4 font-mono font-bold text-right text-lg" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-slate-800'">
                            {{ formatCurrency(totalFormDebit) }}
                        </td>
                        <td class="px-4 py-4 font-mono font-bold text-right text-lg" :class="totalFormDebit !== totalFormCredit ? 'text-red-500' : 'text-slate-800'">
                            {{ formatCurrency(totalFormCredit) }}
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div v-if="totalFormDebit !== totalFormCredit" class="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 mt-4 animate-pulse">
            <i class="pi pi-exclamation-triangle text-xl"></i>
            <div class="text-sm"><span class="font-bold">Tidak Balance!</span> Selisih Rp {{ formatCurrency(Math.abs(totalFormDebit - totalFormCredit)) }}.</div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-3 pt-4">
                <Button label="Batal" icon="pi pi-times" text class="!text-slate-500 hover:!bg-slate-100" @click="close" />
                <Button label="Simpan Jurnal" icon="pi pi-check" class="bg-indigo-600 hover:bg-indigo-700 border-none px-6" :loading="isSubmitting" :disabled="!isFormBalanced" @click="submitJournal" />
            </div>
        </template>
    </Dialog>
</template>