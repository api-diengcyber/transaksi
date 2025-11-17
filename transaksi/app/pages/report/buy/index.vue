<script setup>
import { ref, onMounted } from 'vue';
// Hapus import FilterMatchMode jika error, gunakan string manual 'contains'

const journalService = useJournalService();
const productService = useProductService();

const transactions = ref([]);
const productsMap = ref({}); // Cache data produk lengkap untuk lookup nama & unit
const loading = ref(true);
const expandedRows = ref({});

const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

// --- LOAD DATA ---
const loadData = async () => {
    loading.value = true;
    try {
        // 1. Load Master Produk (Untuk lookup Nama Produk & Nama Satuan dari UUID)
        const productsData = await productService.getAllProducts();
        // Simpan ke Map biar akses cepat: { "uuid": ProductObject }
        productsMap.value = (productsData || []).reduce((acc, curr) => {
            acc[curr.uuid] = curr;
            return acc;
        }, {});

        // 2. Load Jurnal Pembelian
        const rawData = await journalService.getPurchaseReport();

        // 3. Parsing Data Flat ke Object
        transactions.value = rawData.map(journal => {
            // Convert array details [{key, value}] -> Object {key: value}
            const detailsMap = journal.details.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});

            const total = Number(detailsMap['grand_total'] || 0);
            const count = Number(detailsMap['total_items_count'] || 0);
            
            // Reconstruct Items
            const items = [];
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                const uUuid = detailsMap[`unit_uuid#${i}`];
                
                // Lookup Nama Produk & Satuan
                const productMaster = productsMap.value[pUuid];
                const unitMaster = productMaster?.units?.find(u => u.uuid === uUuid);

                items.push({
                    productName: productMaster?.name || 'Unknown Product',
                    unitName: unitMaster?.unitName || 'Unit',
                    qty: Number(detailsMap[`qty#${i}`]),
                    // Perhatikan: key di purchase adalah 'buy_price', bukan 'price'
                    price: Number(detailsMap[`buy_price#${i}`] || 0),
                    subtotal: Number(detailsMap[`subtotal#${i}`] || 0),
                });
            }

            return {
                uuid: journal.uuid,
                code: journal.code, // Kode Jurnal (BUY-...)
                date: journal.createdAt,
                supplier: detailsMap['supplier'] || '-',
                refNo: detailsMap['reference_no'] || '-',
                notes: detailsMap['notes'] || '',
                total: total,
                items: items
            };
        });

    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

// --- FORMATTER ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

onMounted(() => {
    loadData();
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="card animate-fade-in p-4">
        
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Laporan Pembelian</h1>
                <p class="text-surface-500">Rekap stok masuk dari supplier.</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" severity="secondary" outlined @click="loadData" />
                <Button label="Export Excel" icon="pi pi-file-excel" severity="warning" />
            </div>
        </div>

        <div class="card bg-surface-0 dark:bg-surface-900 p-0 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 dark:border-surface-800 flex justify-between items-center bg-orange-50 dark:bg-orange-900/10">
                <span class="p-input-icon-left w-64">
                    <i class="pi pi-search text-surface-500" />
                    <InputText v-model="filters['global'].value" placeholder="Cari Supplier / Nota..." class="w-full p-inputtext-sm" />
                </span>
                
                <div class="text-right">
                    <span class="text-xs text-surface-500 block uppercase font-bold">Total Pengeluaran</span>
                    <span class="font-black text-lg text-orange-600">
                        {{ formatCurrency(transactions.reduce((a, b) => a + b.total, 0)) }}
                    </span>
                </div>
            </div>

            <DataTable 
                v-model:expandedRows="expandedRows" 
                :value="transactions" 
                dataKey="uuid"
                :loading="loading"
                paginator :rows="10"
                :filters="filters"
                stripedRows
                tableStyle="min-width: 60rem"
                class="text-sm"
            >
                <template #empty><div class="p-4 text-center">Belum ada data pembelian.</div></template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No. Transaksi" sortable>
                    <template #body="slotProps">
                        <div class="flex flex-col">
                            <span class="font-mono font-bold text-primary-700">{{ slotProps.data.code }}</span>
                            <span class="text-[10px] text-surface-500">{{ formatDate(slotProps.data.date) }}</span>
                        </div>
                    </template>
                </Column>

                <Column field="supplier" header="Supplier" sortable>
                     <template #body="slotProps">
                        <div class="font-bold">{{ slotProps.data.supplier }}</div>
                        <div v-if="slotProps.data.refNo !== '-'" class="text-xs text-surface-500">Ref: {{ slotProps.data.refNo }}</div>
                    </template>
                </Column>

                <Column field="notes" header="Catatan">
                    <template #body="slotProps">
                        <span class="text-xs italic text-surface-500">{{ slotProps.data.notes || '-' }}</span>
                    </template>
                </Column>

                <Column field="total" header="Total Pembelian" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-bold text-orange-600">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-900 border-t border-b border-surface-200 dark:border-surface-700">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="pi pi-box text-orange-500"></i>
                            <h5 class="font-bold text-surface-600 text-xs uppercase tracking-wide">Rincian Barang Masuk</h5>
                        </div>
                        
                        <DataTable :value="slotProps.data.items" size="small" class="text-xs border border-surface-200 rounded-lg overflow-hidden">
                            <Column field="productName" header="Nama Produk"></Column>
                            <Column field="unitName" header="Satuan" style="width: 100px"></Column>
                            <Column field="qty" header="Qty Masuk" class="text-center" style="width: 100px">
                                <template #body="i">
                                    <span class="font-bold text-green-600">+{{ i.data.qty }}</span>
                                </template>
                            </Column>
                            <Column field="price" header="Harga Beli" class="text-right">
                                <template #body="i">
                                    {{ formatCurrency(i.data.price) }}
                                </template>
                            </Column>
                            <Column field="subtotal" header="Subtotal" class="text-right font-bold" style="width: 150px">
                                <template #body="i">
                                    {{ formatCurrency(i.data.subtotal) }}
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </template>

            </DataTable>
        </div>
    </div>
</template>