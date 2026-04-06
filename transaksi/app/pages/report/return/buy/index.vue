<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const journalService = useJournalService();
const toast = useToast();

const returns = ref([]);
const loading = ref(true);
const expandedRows = ref({});
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- SUMMARY ---
const summary = computed(() => {
    const totalCount = returns.value.length;
    const totalValue = returns.value.reduce((sum, r) => sum + (r.totalReturn || 0), 0);
    return { totalCount, totalValue };
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        const response = await journalService.findAllByType('RET_BUY');
        const dataList = response?.data?.data || response?.data || response || [];
        returns.value = dataList;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat laporan retur beli', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
const formatDate = (d) => (!d) ? '-' : new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

onMounted(() => { loadData(); });
</script>

<template>
    <div class="min-h-screen flex flex-col bg-surface-50 p-4 md:p-6 font-sans">
        
        <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-cyan-900 m-0 flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600">
                        <i class="pi pi-box text-lg"></i>
                    </div>
                    Laporan Retur Pembelian
                </h1>
                <p class="text-sm text-surface-500 mt-1">Daftar pengembalian barang ke supplier/vendor (Stok Keluar).</p>
            </div>
            <Button label="Refresh Data" icon="pi pi-sync" severity="secondary" outlined size="small" @click="loadData" :loading="loading" class="bg-white shadow-sm" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-cyan-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Nota Retur Beli</div>
                <div class="text-2xl font-black text-cyan-700">{{ summary.totalCount }} Transaksi</div>
            </div>
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 border-l-4 border-l-rose-500">
                <div class="text-xs font-bold text-surface-500 uppercase mb-1">Total Nilai Saldo Kembali</div>
                <div class="text-2xl font-black text-rose-600">{{ formatCurrency(summary.totalValue) }}</div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 flex-1 flex flex-col overflow-hidden">
            <div class="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-0/50">
                <div class="relative w-full max-w-md">
                    <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"></i>
                    <input v-model="filters['global'].value" type="text" placeholder="Cari Kode Retur, Supplier, atau Nota Beli..." class="w-full pl-10 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:ring-cyan-500 transition-colors" />
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="returns" 
                dataKey="code" 
                :loading="loading" 
                paginator 
                :rows="10" 
                stripedRows 
                class="p-datatable-sm flex-1 text-sm border-none"
                :filters="filters"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 px-4 text-surface-500">
                        <div class="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mb-4"><i class="pi pi-inbox text-4xl text-surface-400"></i></div>
                        <h3 class="text-lg font-bold text-surface-700">Belum Ada Retur Pembelian</h3>
                        <p class="text-sm mt-1 max-w-sm text-center">Riwayat pengembalian barang ke supplier akan tampil di sini.</p>
                    </div>
                </template>

                <Column expander style="width: 3rem" />
                
                <Column field="code" header="Nota Retur Beli" sortable>
                    <template #body="{ data }">
                        <div class="font-bold font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100 inline-block">{{ data.code }}</div>
                        <div class="text-[10px] text-surface-500 mt-1">{{ formatDate(data.date) }}</div>
                    </template>
                </Column>

                <Column field="refCode" header="Nota Beli Asal" sortable>
                    <template #body="{ data }">
                        <div v-if="data.refCode" class="flex items-center gap-1 text-cyan-600 font-medium">
                            <i class="pi pi-link text-[10px]"></i>
                            {{ data.refCode }}
                        </div>
                        <span v-else class="text-surface-400">-</span>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier / Vendor" sortable>
                    <template #body="{ data }">
                        <span class="font-bold text-surface-800">{{ data.supplier }}</span>
                    </template>
                </Column>

                <Column field="notes" header="Catatan">
                    <template #body="{ data }">
                        <span class="text-xs italic text-surface-600">{{ data.notes || '-' }}</span>
                    </template>
                </Column>

                <Column header="Total Nilai" alignFrozen="right" class="text-right">
                    <template #body="{ data }">
                        <div class="font-black text-cyan-700">{{ formatCurrency(data.totalReturn) }}</div>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-cyan-50/30 border-y border-cyan-100">
                        <h5 class="text-sm font-bold text-cyan-800 mb-3 flex items-center gap-2">
                            <i class="pi pi-truck"></i> Rincian Barang yang Dikembalikan ke Supplier
                        </h5>
                        
                        <div v-if="!slotProps.data.items || slotProps.data.items.length === 0" class="p-4 text-center text-surface-400 italic text-xs bg-white rounded-lg border border-cyan-100">
                            Rincian barang tidak ditemukan.
                        </div>

                        <div v-else class="overflow-x-auto rounded-lg border border-cyan-200 bg-white shadow-sm">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-cyan-50 text-cyan-700 border-b border-cyan-100 uppercase text-[10px]">
                                    <tr>
                                        <th class="px-4 py-2 font-bold">Nama Barang</th>
                                        <th class="px-4 py-2 font-bold text-right">Harga Beli @</th>
                                        <th class="px-4 py-2 font-bold text-center">Qty Retur</th>
                                        <th class="px-4 py-2 font-bold text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-cyan-50">
                                    <tr v-for="(item, i) in slotProps.data.items" :key="i" class="hover:bg-cyan-50/20">
                                        <td class="px-4 py-2 font-semibold text-surface-800">{{ item.name }}</td>
                                        <td class="px-4 py-2 text-right text-surface-500">{{ formatCurrency(item.price) }}</td>
                                        <td class="px-4 py-2 text-center">
                                            <span class="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold">{{ item.qty }}</span>
                                        </td>
                                        <td class="px-4 py-2 text-right font-bold text-cyan-600">{{ formatCurrency(item.subtotal || (item.price * item.qty)) }}</td>
                                    </tr>
                                </tbody>
                                <tfoot class="bg-cyan-50/50 border-t border-cyan-100 font-bold">
                                    <tr>
                                        <td colspan="3" class="px-4 py-2 text-right uppercase text-[10px] text-cyan-600">Total Pengurangan Transaksi</td>
                                        <td class="px-4 py-2 text-right text-sm text-surface-900">{{ formatCurrency(slotProps.data.totalReturn) }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
:deep(.p-datatable-row-expansion) {
    background-color: rgba(236, 254, 255, 0.5) !important;
}
</style>