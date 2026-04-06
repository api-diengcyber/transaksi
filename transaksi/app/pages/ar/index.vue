<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

import { useMemberService } from '~/composables/useMemberService';
import ArCreateModal from '~/components/ar/ArCreateModal.vue';

const journalService = useJournalService();
const memberService = useMemberService(); 
const toast = useToast();

const rawReceivables = ref([]); 
const members = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// KUNCI: State untuk fitur Row Expansion
const expandedRows = ref({}); 

const showCreateModal = ref(false);
const showPaymentModal = ref(false);
const selectedReceivable = ref(null);
const paymentDetails = ref({ amount: null, method: 'CASH', notes: '' });
const paymentProcessing = ref(false);

// --- COMPUTED DATA ---
// Filter hanya tagihan yang BELUM LUNAS untuk tabel utama
const piutangList = computed(() => rawReceivables.value.filter(d => !d.isPaidOff));

const summary = computed(() => {
    const totalPiutang = piutangList.value.reduce((sum, d) => sum + d.total, 0);
    const totalDibayar = piutangList.value.reduce((sum, d) => sum + d.paid, 0);
    const totalSisa = piutangList.value.reduce((sum, d) => sum + d.remaining, 0);
    const jatuhTempoCount = piutangList.value.filter(d => d.dueDate && new Date(d.dueDate) < new Date()).length;
    return { totalPiutang, totalDibayar, totalSisa, jatuhTempoCount };
});

// --- FETCH MASTER MEMBER ---
const loadMembers = async () => {
    try {
        let mData = null;
        if (memberService.getMembers) mData = await memberService.getMembers();
        else if (memberService.getAllMembers) mData = await memberService.getAllMembers();
        let mList = mData?.data?.data || mData?.data || mData || [];
        members.value = Array.isArray(mList) ? mList : [];
    } catch (e) {}
};

// --- LOAD TRANSAKSI DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        if (members.value.length === 0) await loadMembers();

        // 1. Backend sekarang sudah mereturn data yang sangat rapi
        const response = await journalService.findAllByType('AR');
        const dataList = response?.data?.data || response?.data || response || [];
        
        // 2. Cocokkan nama pelanggan dengan database member jika perlu
        rawReceivables.value = dataList.map(item => {
            let finalMemberName = item.member;
            if (item.memberUuid && members.value.length > 0) {
                const dbMember = members.value.find(m => m.uuid === item.memberUuid);
                if (dbMember) finalMemberName = dbMember.name || dbMember.username || finalMemberName;
            }
            return {
                ...item,
                member: finalMemberName
            };
        });

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data Piutang', life: 3000 });
        rawReceivables.value = [];
    } finally {
        loading.value = false;
    }
};

// --- ACTIONS ---
const onTransactionSaved = () => loadData(); 

const openPaymentModal = (receivable) => {
    selectedReceivable.value = receivable;
    paymentDetails.value.amount = receivable.remaining; 
    paymentDetails.value.notes = `Penerimaan Pembayaran Piutang Nota ${receivable.code}`;
    paymentDetails.value.method = 'CASH';
    showPaymentModal.value = true;
};

const processPayment = async () => {
    if (!selectedReceivable.value || paymentDetails.value.amount <= 0 || paymentProcessing.value) return;

    if (paymentDetails.value.amount > selectedReceivable.value.remaining) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Jumlah terima melebihi sisa tagihan.', life: 3000 });
        return;
    }
    
    paymentProcessing.value = true;
    try {
        const payload = {
            amount: paymentDetails.value.amount,
            reference_journal_code: selectedReceivable.value.code,
            payment_method: paymentDetails.value.method,
            notes: paymentDetails.value.notes,
            member: selectedReceivable.value.member,
            member_uuid: selectedReceivable.value.memberUuid 
        };

        if (journalService.createArPaymentTransaction) {
            await journalService.createArPaymentTransaction({ details: payload });
        } else {
            await journalService.createTransaction({ details: { ...payload, transaction_type: 'PAY_AR' }});
        }

        toast.add({ severity: 'success', summary: 'Sukses', detail: `Pembayaran piutang berhasil dicatat.`, life: 3000 });
        showPaymentModal.value = false;
        await loadData();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi Kesalahan', life: 3000 });
    } finally {
        paymentProcessing.value = false;
    }
};

// --- UTILS ---
const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });
const isOverdue = (dateString) => {
    if (!dateString) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return new Date(dateString) < today;
};

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <i class="pi pi-arrow-up-right text-lg"></i>
                    </div>
                    Manajemen Piutang (AR)
                </h1>
                <p class="text-sm text-surface-500 mt-1">Pantau dan kelola tagihan yang belum dibayar oleh pelanggan.</p>
            </div>
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Catat Piutang Manual" icon="pi pi-plus" severity="success" size="small" @click="showCreateModal = true" class="!rounded-xl shadow-sm" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0"><i class="pi pi-users text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Piutang</div><div class="text-xl font-black text-surface-900">{{ formatCurrency(summary.totalPiutang) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0"><i class="pi pi-money-bill text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Dana Diterima (Ags/DP)</div><div class="text-xl font-black text-blue-600">{{ formatCurrency(summary.totalDibayar) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-emerald-500">
                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-wallet text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Sisa Tagihan (Aktif)</div><div class="text-2xl font-black text-emerald-600">{{ formatCurrency(summary.totalSisa) }}</div></div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4" :class="{'border-l-4 border-l-red-500 bg-red-50/10': summary.jatuhTempoCount > 0}">
                <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" :class="summary.jatuhTempoCount > 0 ? 'bg-red-100 text-red-500' : 'bg-surface-100 text-surface-400'"><i class="pi pi-calendar-times text-xl"></i></div>
                <div><div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Lewat Jatuh Tempo</div><div class="text-xl font-black" :class="summary.jatuhTempoCount > 0 ? 'text-red-600' : 'text-surface-900'">{{ summary.jatuhTempoCount }} Transaksi</div></div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="relative w-full sm:w-96">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari No. Faktur atau Pelanggan..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 transition-colors" />
                </div>
                <div class="text-xs font-medium text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg border border-surface-200">
                    Menampilkan <span class="font-bold text-surface-900">{{ piutangList.length }}</span> tagihan aktif
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows"
                :value="piutangList" 
                dataKey="code"
                :loading="loading"
                paginator 
                :rows="15" 
                :rowsPerPageOptions="[15, 30, 50]"
                :filters="filters"
                stripedRows
                responsiveLayout="scroll"
                class="p-datatable-sm flex-1 text-sm border-none"
                :pt="{ headerRow: { class: 'bg-surface-50' } }"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 px-4 text-surface-500">
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-check-circle text-4xl text-emerald-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Semua Tagihan Lunas</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Saat ini tidak ada tagihan piutang dari pelanggan yang tertunda.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="Informasi Tagihan" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-max border border-emerald-100">
                                {{ data.code }}
                            </div>
                            
                            <div v-if="data.refCode" class="text-[10px] text-surface-500 flex items-center gap-1 mt-1">
                                <i class="pi pi-shopping-bag text-[9px] text-emerald-500"></i> Piutang Penjualan
                            </div>
                            
                            <div v-if="data.refCode" class="text-[10px] text-surface-500 flex items-center gap-1">
                                <i class="pi pi-link text-[9px]"></i> Ref: <span class="font-medium font-mono">{{ data.refCode }}</span>
                            </div>
                            <div class="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> Dibuat: {{ formatDate(data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="member" header="Pelanggan / Member" sortable style="min-width: 12rem">
                     <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 uppercase">
                                {{ data.member.substring(0, 1) }}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-surface-800">{{ data.member }}</span>
                                <div class="flex items-center gap-1 mt-0.5">
                                    <i v-if="data.memberUuid" class="pi pi-database text-[8px] text-emerald-500 ml-1" v-tooltip.right="'Tersambung ke Database Member'"></i>
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="dueDate" header="Status / Jatuh Tempo" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex flex-col items-start gap-1">
                            <Tag v-if="isOverdue(data.dueDate)" value="Lewat Waktu" severity="danger" class="!text-[9px] !font-bold !px-2" rounded />
                            <Tag v-else value="Belum Jatuh Tempo" severity="info" class="!text-[9px] !font-bold !px-2 !bg-blue-50 !text-blue-600 !border !border-blue-200" rounded />
                            <span class="text-xs font-medium" :class="isOverdue(data.dueDate) ? 'text-red-600 font-bold' : 'text-surface-600'">
                                {{ data.dueDate ? formatDate(data.dueDate) : 'Tidak diset' }}
                            </span>
                        </div>
                    </template>
                </Column>
                
                <Column header="Rincian Nominal" style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col text-xs space-y-1 w-full max-w-[180px]">
                            <div class="flex justify-between text-surface-600">
                                <span>Total Piutang:</span>
                                <span class="font-semibold">{{ formatCurrency(data.total) }}</span>
                            </div>
                            <div class="flex justify-between text-blue-600">
                                <span>Telah Dibayar:</span>
                                <span>- {{ formatCurrency(data.paid) }}</span>
                            </div>
                            <div class="border-t border-dashed border-surface-200 pt-1 flex justify-between items-center">
                                <span class="font-bold text-surface-800">Sisa Tagihan:</span>
                                <span class="font-black text-sm text-emerald-600">{{ formatCurrency(data.remaining) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column alignFrozen="right" class="text-center" style="width: 6rem">
                    <template #body="{ data }">
                        <Button label="Terima" icon="pi pi-download" severity="success" size="small" class="!rounded-xl !text-xs font-bold shadow-sm !px-3" @click="openPaymentModal(data)" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-emerald-50/30 border-y border-emerald-100">
                        <h5 class="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                            <i class="pi pi-history"></i> Riwayat Pembayaran / Cicilan (Nota: {{ slotProps.data.code }})
                        </h5>
                        
                        <div v-if="slotProps.data.dp > 0" class="mb-2 p-3 bg-white border border-surface-200 rounded-lg flex justify-between items-center shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><i class="pi pi-check text-xs"></i></div>
                                <div>
                                    <div class="text-xs font-bold text-surface-800">Uang Muka (DP) Awal</div>
                                    <div class="text-[10px] text-surface-500">{{ formatDate(slotProps.data.date) }}</div>
                                </div>
                            </div>
                            <div class="font-black text-blue-600">{{ formatCurrency(slotProps.data.dp) }}</div>
                        </div>

                        <div v-if="slotProps.data.payments.length === 0 && slotProps.data.dp === 0" class="p-4 text-center text-surface-500 bg-white rounded-lg border border-surface-200 text-xs italic">
                            Belum ada riwayat pembayaran masuk untuk tagihan ini.
                        </div>

                        <div v-else class="space-y-2">
                            <div v-for="(pay, index) in slotProps.data.payments" :key="index" class="p-3 bg-white border border-surface-200 rounded-lg flex justify-between items-center shadow-sm">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center"><i class="pi pi-arrow-down-left text-xs"></i></div>
                                    <div>
                                        <div class="text-xs font-bold text-surface-800 font-mono">{{ pay.code }}</div>
                                        <div class="text-[10px] text-surface-500 flex gap-2">
                                            <span>{{ formatDate(pay.date) }}</span>
                                            <span v-if="pay.notes" class="italic text-surface-400 border-l border-surface-300 pl-2">"{{ pay.notes }}"</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="font-black text-emerald-600">+ {{ formatCurrency(pay.amount) }}</div>
                            </div>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>

        <Dialog v-model:visible="showPaymentModal" header="Terima Pembayaran Piutang" :modal="true" class="w-[95vw] sm:w-[450px]" :pt="{ root: { class: '!rounded-2xl !border-0 !shadow-2xl' }, header: { class: '!bg-surface-50 !border-b !border-surface-200 !pb-4' }, content: { class: '!pt-4 !pb-0' } }">
            <div v-if="selectedReceivable" class="flex flex-col h-full">
                
                <div class="mb-5 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col gap-2 relative overflow-hidden">
                    <div class="absolute -right-4 -bottom-4 opacity-10"><i class="pi pi-money-bill text-8xl"></i></div>
                    <div><span class="text-xs text-emerald-700/70 font-semibold uppercase tracking-wider block">Pelanggan / Member</span><span class="font-bold text-emerald-900 text-base">{{ selectedReceivable.member }}</span></div>
                    <div class="flex justify-between items-end mt-2 pt-2 border-t border-emerald-200/50 relative z-10">
                        <div><span class="text-[10px] text-emerald-700/70 font-semibold block mb-0.5">Sisa Tagihan</span><span class="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded text-emerald-800">{{ selectedReceivable.code }}</span></div>
                        <span class="text-2xl font-black text-emerald-700">{{ formatCurrency(selectedReceivable.remaining) }}</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Dana yang Diterima</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-400">Rp</span>
                            <InputNumber v-model="paymentDetails.amount" mode="decimal" locale="id-ID" :max="selectedReceivable.remaining" class="w-full" inputClass="!text-lg !font-black !py-2.5 !pl-9 !text-emerald-600 focus:!ring-emerald-500 focus:!border-emerald-500" />
                        </div>
                        <div class="flex justify-end mt-1"><button class="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline bg-emerald-50 px-2 py-0.5 rounded transition-colors" @click="paymentDetails.amount = selectedReceivable.remaining">Bayar Lunas</button></div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Diterima Ke (Metode)</label>
                        <SelectButton v-model="paymentDetails.method" :options="[{label:'Tunai (Cash)', value:'CASH'}, {label:'Transfer Bank', value:'TRANSFER'}]" optionLabel="label" optionValue="value" class="w-full" :pt="{ button: { class: '!text-xs !py-2.5 flex-1' } }" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Catatan / Referensi</label>
                        <Textarea v-model="paymentDetails.notes" rows="2" class="w-full !text-sm resize-none" placeholder="Cth: Transfer via BCA..." />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="flex gap-2 w-full pt-4 border-t border-surface-200 mt-2">
                    <Button label="Batal" class="flex-1 !rounded-xl font-bold" severity="secondary" text @click="showPaymentModal = false" />
                    <Button label="Terima Pembayaran" icon="pi pi-check-circle" class="flex-[2] !rounded-xl font-bold shadow-md" severity="success" @click="processPayment" :loading="paymentProcessing" />
                </div>
            </template>
        </Dialog>
        <ArCreateModal v-model:visible="showCreateModal" defaultType="piutang" @saved="onTransactionSaved" />
    </div>
</template>