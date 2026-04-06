<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useSupplierService } from '~/composables/useSupplierService';

const journalService = useJournalService();
const supplierService = useSupplierService();
const toast = useToast();

const purchases = ref([]);
const suppliers = ref([]);
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const expandedRows = ref({});

// --- SUMMARY ---
const summary = computed(() => {
    let totalValue = 0;
    let totalHutang = 0;
    let totalRetur = 0;
    purchases.value.forEach(p => {
        totalValue += p.total;
        totalHutang += p.remaining;
        totalRetur += p.returns.reduce((s, r) => s + r.amount, 0);
    });
    return { totalValue, totalHutang, totalRetur };
});

const loadMasterSuppliers = async () => {
    try {
        const res = await supplierService.getAllSuppliers();
        suppliers.value = res?.data?.data || res?.data || res || [];
    } catch (e) {}
};

const loadData = async () => {
    loading.value = true;
    try {
        if (suppliers.value.length === 0) await loadMasterSuppliers();
        const response = await journalService.findAllByType('BUY');
        const dataList = response?.data?.data || response?.data || response || [];
        
        purchases.value = dataList.map(item => {
            let finalName = item.supplier;
            if (item.supplierUuid) {
                const dbSup = suppliers.value.find(s => s.uuid === item.supplierUuid);
                if (dbSup) finalName = dbSup.name || dbSup.username || finalName;
            }
            return { ...item, supplier: finalName };
        });
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const formatDate = (d) => (!d) ? '-' : new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-emerald-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <i class="pi pi-shopping-cart text-lg"></i>
                    </div>
                    Laporan Pembelian
                </h1>
                <p class="text-sm text-surface-500 mt-1">Rekapitulasi stok masuk, kewajiban hutang, dan histori retur supplier.</p>
            </div>
            <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="bg-white shadow-sm" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-emerald-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Nilai Belanja</div>
                <div class="text-2xl font-black text-emerald-700">{{ formatCurrency(summary.totalValue) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-rose-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Sisa Hutang Aktif</div>
                <div class="text-2xl font-black text-rose-600">{{ formatCurrency(summary.totalHutang) }}</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-cyan-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Nilai Retur</div>
                <div class="text-2xl font-black text-cyan-600">{{ formatCurrency(summary.totalRetur) }}</div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-0/50">
                <div class="relative w-full max-w-md">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Faktur atau Supplier..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-emerald-500 transition-colors" />
                </div>
            </div>

            <DataTable v-model:expandedRows="expandedRows" :value="purchases" dataKey="code" :loading="loading" paginator :rows="10" stripedRows class="p-datatable-sm flex-1 text-sm border-none">
                <Column expander style="width: 3rem" />
                
                <Column field="code" header="Nota Pembelian" sortable>
                    <template #body="{ data }">
                        <div class="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block">{{ data.code }}</div>
                        <div v-if="data.referenceNo" class="text-[10px] text-surface-400 mt-1">Ref: {{ data.referenceNo }}</div>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier / Vendor" sortable>
                    <template #body="{ data }">
                        <span class="font-bold text-surface-800">{{ data.supplier }}</span>
                        <div class="text-[10px] text-surface-500">{{ formatDate(data.date) }}</div>
                    </template>
                </Column>

                <Column header="Status Bayar">
                    <template #body="{ data }">
                        <Tag v-if="!data.isCredit" value="TUNAI" severity="success" rounded class="!text-[9px]" />
                        <Tag v-else :value="data.remaining <= 0.01 ? 'HUTANG LUNAS' : 'HUTANG AKTIF'" :severity="data.remaining <= 0.01 ? 'info' : 'danger'" rounded class="!text-[9px]" />
                    </template>
                </Column>

                <Column header="Total Transaksi" alignFrozen="right" class="text-right">
                    <template #body="{ data }">
                        <div class="font-black text-emerald-700">{{ formatCurrency(data.total) }}</div>
                        <div class="text-[9px] text-surface-400 uppercase tracking-tighter">Sisa Hutang: {{ formatCurrency(data.remaining) }}</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-100/50 border-y border-surface-200 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        
                        <div class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm col-span-1 xl:col-span-2">
                            <h5 class="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2"><i class="pi pi-box"></i> 1. Rincian Barang Masuk (Stok)</h5>
                            <table class="w-full text-left text-xs border rounded-lg overflow-hidden">
                                <thead class="bg-surface-50 text-surface-600 border-b">
                                    <tr>
                                        <th class="px-4 py-2 font-bold">Nama Barang</th>
                                        <th class="px-4 py-2 font-bold text-right">Harga Beli</th>
                                        <th class="px-4 py-2 font-bold text-center">Qty</th>
                                        <th class="px-4 py-2 font-bold text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y">
                                    <tr v-for="(item, i) in slotProps.data.items" :key="i">
                                        <td class="px-4 py-2 font-semibold">{{ item.name }}</td>
                                        <td class="px-4 py-2 text-right">{{ formatCurrency(item.price) }}</td>
                                        <td class="px-4 py-2 text-center">{{ item.qty }}</td>
                                        <td class="px-4 py-2 text-right font-bold text-emerald-600">{{ formatCurrency(item.subtotal) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div v-if="slotProps.data.isCredit" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                            <h5 class="text-sm font-bold text-rose-800 mb-3 flex items-center gap-2"><i class="pi pi-money-bill"></i> 2. Histori Pembayaran Hutang</h5>
                            <div class="space-y-2">
                                <div v-if="slotProps.data.dp > 0" class="p-2 border rounded bg-surface-50 flex justify-between text-xs">
                                    <span>Uang Muka (DP)</span><span class="font-bold text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</span>
                                </div>
                                <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-2 border rounded bg-surface-50 flex justify-between text-xs">
                                    <div class="flex flex-col">
                                        <span class="font-bold">{{ pay.code }}</span>
                                        <span class="text-[10px] text-surface-400">{{ formatDate(pay.date) }}</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">+ {{ formatCurrency(pay.amount) }}</span>
                                </div>
                                <div v-if="slotProps.data.payments.length === 0 && slotProps.data.dp === 0" class="text-center py-4 text-surface-400 italic text-xs">Belum ada pembayaran.</div>
                            </div>
                        </div>

                        <div v-if="slotProps.data.returns.length > 0" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm" :class="{'xl:col-span-2': !slotProps.data.isCredit}">
                            <h5 class="text-sm font-bold text-cyan-800 mb-3 flex items-center gap-2"><i class="pi pi-replay"></i> {{ slotProps.data.isCredit ? '3.' : '2.' }} Histori Retur Pembelian</h5>
                            <div v-for="(ret, idx) in slotProps.data.returns" :key="idx" class="p-2 border border-cyan-100 rounded bg-cyan-50/30 flex justify-between text-xs mb-2">
                                <div class="flex flex-col">
                                    <span class="font-bold">{{ ret.code }}</span>
                                    <span class="text-[10px] text-surface-400">{{ formatDate(ret.date) }}</span>
                                </div>
                                <span class="font-bold text-cyan-700">Refund: {{ formatCurrency(ret.amount) }}</span>
                            </div>
                        </div>

                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>