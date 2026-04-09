<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const returns = ref([]); 
const loading = ref(true);
const processing = ref(false);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- MODAL STATE ---
const showReturnModal = ref(false);
const searchQuery = ref('');
const selectedSale = ref(null);
const returnCart = ref([]);
const returnNotes = ref('');

// --- LOAD DATA (Hanya Load Histori Retur Saja) ---
const loadData = async () => {
    loading.value = true;
    try {
        const response = await journalService.findAllByType('RET_SALE');
        const dataList = response?.data?.data || response?.data || response || [];
        returns.value = dataList;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat histori retur', life: 3000 });
        returns.value = [];
    } finally {
        loading.value = false;
    }
};

// --- COMPUTED ---
const totalRefundGlobal = computed(() => returns.value.reduce((sum, r) => sum + (r.totalReturn || 0), 0));
const totalItemRefund = computed(() => {
    return returnCart.value.reduce((sum, item) => sum + (item.price * item.qty_return), 0);
});

const isProcessDisabled = computed(() => {
    if (!selectedSale.value) return true;
    if (returnCart.value.length === 0) return true;
    const hasReturnQty = returnCart.value.some(i => i.qty_return > 0);
    return !hasReturnQty || processing.value;
});

// --- ACTIONS (PENCARIAN FAKTUR MELALUI API) ---
const searchSale = async () => {
    const q = searchQuery.value.trim().toUpperCase();
    if (!q) {
        toast.add({ severity: 'warn', summary: 'Kosong', detail: 'Masukkan kode faktur penjualan!', life: 2000 });
        return;
    }

    try {
        // HIT API PENCARIAN BERDASARKAN KODE
        const response = await journalService.getSaleByCode(q);
        const data = response?.data || response;

        if (data && data.code) {
            selectedSale.value = data;
            
            // Data sudah rapi dari Backend, langsung masukkan ke cart!
            if (data.items && data.items.length > 0) {
                returnCart.value = data.items;
                toast.add({ severity: 'success', summary: 'Ditemukan', detail: 'Faktur Penjualan berhasil dimuat', life: 2000 });
            } else {
                toast.add({ severity: 'warn', summary: 'Kosong', detail: 'Faktur ditemukan tapi tidak ada daftar barang.', life: 3000 });
                selectedSale.value = null;
                returnCart.value = [];
            }
        } else {
            toast.add({ severity: 'error', summary: 'Tidak Ditemukan', detail: 'Faktur tidak ditemukan dalam sistem.', life: 3000 });
            selectedSale.value = null;
            returnCart.value = [];
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Terjadi kesalahan saat mencari faktur', life: 3000 });
        selectedSale.value = null;
        returnCart.value = [];
    }
};

const processReturn = async () => {
    if (isProcessDisabled.value) return;

    processing.value = true;
    try {
        const itemsToReturn = returnCart.value.filter(i => i.qty_return > 0);
        
        const payload = {
            details: {
                reference_journal_code: selectedSale.value.code,
                member: selectedSale.value.member || 'Pelanggan Umum',
                notes: returnNotes.value || 'Retur Pelanggan',
                grand_total: totalItemRefund.value,
                items: itemsToReturn 
            }
        };

        // Buat transaksi RET_SALE
        await journalService.createReturnSaleTransaction(payload.details);

        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Retur Penjualan Berhasil Diproses', life: 3000 });
        closeModal();
        await loadData();

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memproses retur', life: 3000 });
    } finally {
        processing.value = false;
    }
};

const openModal = async () => {
    showReturnModal.value = true;
    searchQuery.value = '';
    selectedSale.value = null;
    returnCart.value = [];
    returnNotes.value = '';
};

const closeModal = () => { showReturnModal.value = false; };

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString) => (!dateString) ? '-' : new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                        <i class="pi pi-replay text-lg"></i>
                    </div>
                    Manajemen Retur Jual
                </h1>
                <p class="text-sm text-surface-500 mt-1">Kelola pengembalian barang dari pelanggan dan pengembalian dana.</p>
            </div>
            
            <div class="flex gap-2">
                <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="!rounded-xl shadow-sm bg-white" />
                <Button label="Buat Retur Baru" icon="pi pi-plus" severity="warning" size="small" @click="openModal" class="!rounded-xl shadow-sm" />
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4 border-l-4 border-l-orange-500">
                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                    <i class="pi pi-replay text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Transaksi Retur</div>
                    <div class="text-xl font-black text-surface-900">{{ returns.length }} Nota</div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-surface-100 flex items-center justify-center text-surface-500 shrink-0">
                    <i class="pi pi-wallet text-xl"></i>
                </div>
                <div>
                    <div class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Refund</div>
                    <div class="text-xl font-black text-orange-600">{{ formatCurrency(totalRefundGlobal) }}</div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-0/50">
                <div class="relative w-full sm:w-96">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Kode Retur atau Pelanggan..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-orange-500 focus:border-orange-500 transition-colors" />
                </div>
            </div>

            <DataTable 
                :value="returns" 
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
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-check-circle text-4xl text-orange-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Belum Ada Retur</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Data histori retur penjualan akan tampil di sini.</p>
                    </div>
                </template>

                <Column field="code" header="Informasi Retur" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            <div class="font-bold font-mono text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md inline-block w-max border border-orange-100">{{ data.code }}</div>
                            <div v-if="data.refCode" class="text-[10px] text-surface-500 flex items-center gap-1 mt-1">
                                <i class="pi pi-link text-[9px]"></i> Asal Nota: <span class="font-medium font-mono">{{ data.refCode }}</span>
                            </div>
                            <div class="text-xs text-surface-500 flex items-center gap-1 mt-0.5">
                                <i class="pi pi-calendar text-[10px]"></i> {{ formatDate(data.date) }}
                            </div>
                        </div>
                    </template>
                </Column>
                
                <Column field="member" header="Pelanggan" sortable style="min-width: 12rem">
                     <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 uppercase">{{ data.member?.substring(0, 1) || '?' }}</div>
                            <span class="font-bold text-surface-800">{{ data.member || 'Umum' }}</span>
                        </div>
                    </template>
                </Column>

                <Column field="notes" header="Catatan" style="min-width: 14rem">
                    <template #body="{ data }">
                        <span class="text-xs text-surface-600 italic">"{{ data.notes || '-' }}"</span>
                    </template>
                </Column>
                
                <Column header="Total Nilai Refund" alignFrozen="right" class="text-right" style="min-width: 10rem">
                    <template #body="{ data }">
                        <span class="font-black text-sm text-orange-600">{{ formatCurrency(data.totalReturn) }}</span>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="showReturnModal" header="Proses Retur Penjualan" :modal="true" class="w-[95vw] sm:w-[600px]" :pt="{ root: { class: '!rounded-2xl !border-0 !shadow-2xl' }, header: { class: '!bg-surface-50 !border-b !border-surface-200 !pb-4' }, content: { class: '!p-0' } }">
            <div class="flex flex-col h-full bg-surface-50/30">
                
                <div class="p-4 border-b border-surface-200 bg-white">
                    <label class="text-xs font-bold text-surface-600 uppercase block mb-1">Cari Kode Faktur Jual (SALE-xxx)</label>
                    <div class="flex gap-2">
                        <InputText v-model="searchQuery" placeholder="Cth: SALE-12345..." class="w-full font-mono text-sm" @keydown.enter="searchSale" />
                        <Button icon="pi pi-search" severity="secondary" @click="searchSale" />
                    </div>
                </div>

                <div v-if="selectedSale" class="p-4 overflow-y-auto max-h-[50vh] scrollbar-thin">
                    <div class="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                        <div class="text-[10px] text-orange-600 font-bold uppercase mb-1">Informasi Faktur Asli</div>
                        <div class="font-mono font-bold text-orange-900">{{ selectedSale.code }}</div>
                        <div class="text-xs text-orange-800 mt-0.5">Pelanggan: <span class="font-bold">{{ selectedSale.member || 'Umum' }}</span></div>
                    </div>

                    <h4 class="text-sm font-bold text-surface-800 mb-2">Pilih Barang yang Diretur</h4>
                    <div class="space-y-3">
                        <div v-for="(item, idx) in returnCart" :key="idx" class="p-3 bg-white border border-surface-200 rounded-xl shadow-sm">
                            <div class="flex justify-between items-start mb-2 border-b border-surface-100 pb-2">
                                <div>
                                    <div class="font-bold text-sm text-surface-800">{{ item.name }}</div>
                                    <div class="text-[10px] text-surface-500 mt-0.5">Dibeli: <span class="font-bold text-surface-700">{{ item.qty_bought }} {{ item.unitName }}</span> ({{ formatCurrency(item.price) }}/{{ item.unitName }})</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-[10px] uppercase text-surface-400 font-bold">Total Refund Item</div>
                                    <div class="font-black text-orange-600">{{ formatCurrency(item.price * item.qty_return) }}</div>
                                </div>
                            </div>
                            
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-surface-600">Qty Dikembalikan:</span>
                                <div class="flex items-center bg-surface-100 rounded-lg border border-surface-200 h-8 w-28">
                                    <button class="w-8 h-full flex items-center justify-center hover:bg-surface-200 rounded-l-lg transition text-surface-600 hover:text-red-500" @click="item.qty_return > 0 ? item.qty_return-- : null"><i class="pi pi-minus text-[10px] font-bold"></i></button>
                                    <input v-model="item.qty_return" type="number" class="w-full h-full bg-transparent text-center text-sm font-bold border-none outline-none appearance-none m-0 p-0 focus:ring-0" min="0" :max="item.qty_bought" @input="item.qty_return > item.qty_bought ? item.qty_return = item.qty_bought : null" />
                                    <button class="w-8 h-full flex items-center justify-center hover:bg-surface-200 rounded-r-lg transition text-emerald-600" @click="item.qty_return < item.qty_bought ? item.qty_return++ : null"><i class="pi pi-plus text-[10px] font-bold"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 flex flex-col gap-1">
                        <label class="text-xs font-bold text-surface-600 uppercase">Catatan Alasan Retur</label>
                        <Textarea v-model="returnNotes" rows="2" class="w-full !text-sm resize-none" placeholder="Cth: Barang cacat pabrik..." />
                    </div>
                </div>

                <div v-else class="p-8 text-center text-surface-400 italic text-sm">
                    Silakan cari Faktur Penjualan terlebih dahulu.
                </div>
            </div>

            <template #footer>
                <div class="flex items-center justify-between w-full pt-3 border-t border-surface-200 px-4 pb-4">
                    <div class="text-left">
                        <span class="text-[10px] uppercase font-bold text-surface-500 block mb-0.5">Total Pengembalian Dana</span>
                        <span class="text-xl font-black text-orange-600">{{ formatCurrency(totalItemRefund) }}</span>
                    </div>
                    <div class="flex gap-2">
                        <Button label="Batal" class="!rounded-xl font-bold" severity="secondary" text @click="closeModal" />
                        <Button label="Proses Retur" icon="pi pi-check" class="!rounded-xl font-bold shadow-md" severity="warning" @click="processReturn" :loading="processing" :disabled="isProcessDisabled" />
                    </div>
                </div>
            </template>
        </Dialog>

    </div>
</template>

<style scoped>
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
.scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(249, 115, 22, 0.3); border-radius: 20px; }
</style>