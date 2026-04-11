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
        
        // Pengecekan aman jika p.returns undefined
        if (p.returns && Array.isArray(p.returns)) {
             totalRetur += p.returns.reduce((s, r) => s + r.amount, 0);
        }
    });
    return { totalValue, totalHutang, totalRetur };
});

const loadMasterSuppliers = async () => {
    try {
        let res = null;
        if (supplierService.getSuppliers) res = await supplierService.getSuppliers();
        else if (supplierService.getAllSuppliers) res = await supplierService.getAllSuppliers();
        
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
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan pembelian', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
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
            <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="bg-white shadow-sm !rounded-xl" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-emerald-500 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-shopping-bag text-xl"></i></div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Belanja</div>
                    <div class="text-xl font-black text-emerald-700">{{ formatCurrency(summary.totalValue) }}</div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-orange-500 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0"><i class="pi pi-credit-card text-xl"></i></div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Sisa Hutang (AP) Aktif</div>
                    <div class="text-xl font-black text-orange-600">{{ formatCurrency(summary.totalHutang) }}</div>
                </div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-cyan-500 flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 shrink-0"><i class="pi pi-replay text-xl"></i></div>
                <div>
                    <div class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1">Total Nilai Retur</div>
                    <div class="text-xl font-black text-cyan-600">{{ formatCurrency(summary.totalRetur) }}</div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-0/50">
                <div class="relative w-full max-w-md">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Faktur PO, Ref Supplier, atau Nama..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-emerald-500 transition-colors" />
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="purchases" 
                dataKey="code" 
                :loading="loading" 
                paginator 
                :rows="15" 
                :rowsPerPageOptions="[15, 30, 50]"
                stripedRows 
                class="p-datatable-sm flex-1 text-sm border-none"
                :pt="{ headerRow: { class: 'bg-surface-50' } }"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 px-4 text-surface-500">
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-inbox text-4xl text-surface-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Belum Ada Transaksi Pembelian</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Data faktur kulakan akan muncul di sini setelah Anda menyelesaikan pembelian stok.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />
                
                <Column field="code" header="Nomor PO / Transaksi" sortable style="min-width: 14rem">
                    <template #body="{ data }">
                        <div class="flex flex-col gap-1 py-1">
                            
                            <div class="font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-max border border-emerald-200 shadow-sm" v-tooltip.top="'Nomor Faktur / PO Internal'">
                                <i class="pi pi-file text-[10px] mr-1"></i> {{ data.invoiceCode || data.code }}
                            </div>
                            
                            <div class="flex flex-wrap gap-1 mt-1">
                                <div v-if="data.invoice_code && data.invoice_code !== data.code" class="text-[10px] font-mono text-surface-500 flex items-center gap-1 bg-surface-100 px-1 py-0.5 rounded border border-surface-200">
                                    <i class="pi pi-database text-[9px]"></i> {{ data.code }}
                                </div>
                                
                                <div v-if="data.referenceNo && data.referenceNo !== '-'" class="text-[10px] font-mono font-bold text-surface-700 flex items-center gap-1 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-300 shadow-sm" v-tooltip.bottom="'Nota Surat Jalan dari Supplier'">
                                    <i class="pi pi-truck text-[9px]"></i> Ref: {{ data.referenceNo }}
                                </div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier / Vendor" sortable style="min-width: 12rem">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 uppercase shrink-0">
                                {{ (data.supplier || '?').substring(0, 1) }}
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-surface-800">{{ data.supplier }}</span>
                                <span class="text-[10px] text-surface-500 mt-0.5 flex items-center gap-1"><i class="pi pi-calendar text-[10px]"></i> {{ formatDate(data.date) }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Status Pembayaran" sortable field="isCredit" style="min-width: 10rem">
                    <template #body="{ data }">
                        <Tag v-if="!data.isCredit" value="LUNAS / TUNAI" severity="success" rounded class="!text-[9px] !font-bold" />
                        <Tag v-else :value="data.remaining <= 0.01 ? 'HUTANG LUNAS' : 'HUTANG AKTIF'" :severity="data.remaining <= 0.01 ? 'info' : 'danger'" rounded class="!text-[9px] !font-bold" />
                        
                        <div v-if="data.paymentMethod && data.paymentMethod !== 'CASH' && data.paymentMethod !== 'CREDIT'" class="text-[10px] text-surface-500 mt-1 font-mono">
                            Via: {{ data.paymentMethod }}
                        </div>
                    </template>
                </Column>

                <Column header="Total Belanja" alignFrozen="right" class="text-right" style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="font-black text-emerald-700 text-sm">{{ formatCurrency(data.total) }}</div>
                        <div v-if="data.isCredit" class="text-[9px] text-rose-500 uppercase tracking-tighter mt-0.5 font-bold">
                            Sisa AP: {{ formatCurrency(data.remaining) }}
                        </div>
                        <div v-else class="text-[9px] text-surface-400 mt-0.5">{{ data.items ? data.items.length : 0 }} Item</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-100/50 border-y border-surface-200 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        
                        <div class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm col-span-1 xl:col-span-2">
                            <div class="flex justify-between items-center mb-3 border-b border-surface-100 pb-2">
                                <h5 class="text-sm font-bold text-emerald-800 flex items-center gap-2 m-0"><i class="pi pi-box"></i> 1. Rincian Barang Masuk (Stok Bertambah)</h5>
                                <span class="text-xs font-mono font-bold text-surface-400">PO: {{ slotProps.data.invoice_code || slotProps.data.code }}</span>
                            </div>
                            
                            <div v-if="!slotProps.data.items || slotProps.data.items.length === 0" class="p-4 text-center text-surface-400 italic text-xs">
                                Rincian barang tidak ditemukan.
                            </div>
                            
                            <div v-else class="overflow-x-auto rounded-lg border border-surface-200">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-surface-50 text-surface-600 border-b border-surface-200 uppercase text-[10px]">
                                        <tr>
                                            <th class="px-4 py-2 font-bold w-12 text-center">No</th>
                                            <th class="px-4 py-2 font-bold">Nama Barang</th>
                                            <th class="px-4 py-2 font-bold text-right">Harga Modal Beli</th>
                                            <th class="px-4 py-2 font-bold text-center">Qty</th>
                                            <th class="px-4 py-2 font-bold text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-surface-100">
                                        <tr v-for="(item, i) in slotProps.data.items" :key="i">
                                            <td class="px-4 py-2 text-center text-surface-400">{{ i + 1 }}</td>
                                            <td class="px-4 py-2 font-semibold text-surface-800">{{ item.name }}</td>
                                            <td class="px-4 py-2 text-right">{{ formatCurrency(item.price) }}</td>
                                            <td class="px-4 py-2 text-center"><span class="bg-surface-100 px-2 py-0.5 rounded border">{{ item.qty }}</span></td>
                                            <td class="px-4 py-2 text-right font-bold text-emerald-600">{{ formatCurrency(item.subtotal) }}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot class="bg-surface-50 border-t border-surface-200 font-bold">
                                        <tr>
                                            <td colspan="4" class="px-4 py-3 text-right uppercase text-[10px] text-surface-500">Grand Total PO</td>
                                            <td class="px-4 py-3 text-right text-sm text-surface-900">{{ formatCurrency(slotProps.data.total) }}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div v-if="slotProps.data.isCredit" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm">
                            <div class="flex justify-between items-center mb-3">
                                <h5 class="text-sm font-bold text-orange-800 flex items-center gap-2 m-0"><i class="pi pi-money-bill"></i> 2. Histori Cicilan Hutang (AP)</h5>
                                <Tag :value="slotProps.data.remaining <= 0.01 ? 'LUNAS' : 'HUTANG AKTIF'" :severity="slotProps.data.remaining <= 0.01 ? 'info' : 'danger'" class="!text-[9px]" />
                            </div>
                            
                            <div class="space-y-2">
                                <div v-if="slotProps.data.dp > 0" class="p-2 border border-surface-100 rounded-lg flex justify-between items-center bg-surface-50 text-xs">
                                    <span class="text-surface-600"><i class="pi pi-check-circle text-emerald-500 mr-1"></i> Uang Muka (DP) Awal</span>
                                    <span class="font-bold text-emerald-600">{{ formatCurrency(slotProps.data.dp) }}</span>
                                </div>
                                <div v-for="(pay, idx) in slotProps.data.payments" :key="idx" class="p-2 border border-surface-100 rounded-lg flex justify-between items-center bg-surface-50 text-xs">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-surface-800"><i class="pi pi-arrow-down-left text-emerald-500 mr-1 text-[10px]"></i> {{ pay.code }}</span>
                                        <span class="text-[10px] text-surface-500 mt-0.5 ml-4">{{ formatDate(pay.date) }}</span>
                                    </div>
                                    <span class="font-bold text-emerald-600">+ {{ formatCurrency(pay.amount) }}</span>
                                </div>
                                <div v-if="(!slotProps.data.payments || slotProps.data.payments.length === 0) && (!slotProps.data.dp || slotProps.data.dp === 0)" class="text-center py-4 text-surface-400 italic text-xs border border-dashed border-surface-200 rounded">
                                    Belum ada cicilan/pembayaran tercatat.
                                </div>
                            </div>

                            <div class="mt-3 pt-3 border-t border-dashed border-surface-200 flex justify-between items-center">
                                <span class="text-xs font-bold text-surface-600">Sisa Tagihan ke Supplier</span>
                                <span class="font-black text-rose-600">{{ formatCurrency(slotProps.data.remaining) }}</span>
                            </div>
                        </div>

                        <div v-if="slotProps.data.returns && slotProps.data.returns.length > 0" class="bg-white p-4 rounded-xl border border-surface-200 shadow-sm" :class="{'xl:col-span-2': !slotProps.data.isCredit}">
                            <h5 class="text-sm font-bold text-cyan-800 mb-3 flex items-center gap-2 m-0"><i class="pi pi-replay"></i> {{ slotProps.data.isCredit ? '3.' : '2.' }} Histori Retur Pembelian</h5>
                            <div class="space-y-2">
                                <div v-for="(ret, idx) in slotProps.data.returns" :key="idx" class="p-2 border border-cyan-100 rounded-lg flex justify-between items-center bg-cyan-50/50 text-xs">
                                    <div class="flex flex-col">
                                        <span class="font-bold text-surface-800"><i class="pi pi-arrow-up-right text-cyan-600 mr-1 text-[10px]"></i> {{ ret.code }}</span>
                                        <span class="text-[10px] text-surface-500 mt-0.5 ml-4">{{ formatDate(ret.date) }}</span>
                                    </div>
                                    <span class="font-bold text-cyan-700">Nominal Retur: {{ formatCurrency(ret.amount) }}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
.p-datatable .p-datatable-tbody > tr.p-highlight {
    background-color: #ecfdf5 !important; /* Tema hijau muda saat row pembelian di-expand */
}
</style>