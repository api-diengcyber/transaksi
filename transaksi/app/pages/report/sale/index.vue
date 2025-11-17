<script setup>
import { ref, onMounted, computed } from 'vue';
import dayjs from 'dayjs'; // Pastikan install dayjs atau pakai Date native

const journalService = useJournalService();
const productService = useProductService();

const transactions = ref([]);
const productsMap = ref({}); // Cache nama produk: { uuid: 'Nama Produk' }
const loading = ref(true);
const expandedRows = ref({}); // Untuk expand detail transaksi

// Filter
const filters = ref({ global: { value: null, matchMode: 'contains' } });

// --- DATA LOADING & PARSING ---

const loadData = async () => {
    loading.value = true;
    try {
        // 1. Load Produk (Untuk Mapping Nama dari UUID)
        const productsData = await productService.getAllProducts();
        productsMap.value = (productsData || []).reduce((acc, curr) => {
            acc[curr.uuid] = curr.name;
            return acc;
        }, {});

        // 2. Load Jurnal Penjualan
        const rawData = await journalService.getSalesReport();
        
        // 3. Parsing Data Flat ke Struktur Object
        transactions.value = rawData.map(journal => {
            // Ubah array details [{key:..., value:...}] menjadi Object {key: value}
            const detailsMap = journal.details.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});

            // Ambil Summary
            const total = Number(detailsMap['grand_total'] || 0);
            const payMethod = detailsMap['payment_method'] || 'CASH';
            
            // Reconstruct Items dari Flat Keys (qty_0, productUuid_0, dst)
            const items = [];
            const count = Number(detailsMap['total_items_count'] || 0);
            
            for (let i = 0; i < count; i++) {
                const pUuid = detailsMap[`product_uuid#${i}`];
                items.push({
                    productName: productsMap.value[pUuid] || 'Unknown Product', // Map UUID ke Nama
                    unitName: 'Unit', // Idealnya simpan unitName di journal juga biar akurat
                    qty: Number(detailsMap[`qty#${i}`]),
                    price: Number(detailsMap[`price#${i}`]),
                    subtotal: Number(detailsMap[`subtotal#${i}`]),
                });
            }

            return {
                uuid: journal.uuid,
                code: journal.code,
                date: journal.createdAt,
                total: total,
                method: payMethod,
                items: items // Array detail barang
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
    return dayjs(dateString).format('DD MMM YYYY HH:mm');
};

const getSeverity = (method) => {
    switch (method) {
        case 'CASH': return 'success';
        case 'QRIS': return 'info';
        case 'TRANSFER': return 'warning';
        default: return 'secondary';
    }
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
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">Laporan Penjualan</h1>
                <p class="text-surface-500">Rekap transaksi dari jurnal harian.</p>
            </div>
            <div class="flex gap-2">
                <Button icon="pi pi-refresh" severity="secondary" outlined @click="loadData" />
                <Button label="Export Excel" icon="pi pi-file-excel" severity="primary" />
            </div>
        </div>

        <div class="card bg-surface-0 dark:bg-surface-900 p-0 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
            
            <div class="p-4 border-b border-surface-100 dark:border-surface-800 flex justify-between">
                <span class="p-input-icon-left w-64">
                    <i class="pi pi-search" />
                    <InputText v-model="filters['global'].value" placeholder="Cari No Transaksi..." class="w-full p-inputtext-sm" />
                </span>
                
                <div class="font-bold text-lg text-primary-600">
                    Total Omset: {{ formatCurrency(transactions.reduce((a, b) => a + b.total, 0)) }}
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
                <template #empty>Belum ada data penjualan.</template>

                <Column expander style="width: 3rem" />

                <Column field="code" header="No. Transaksi" sortable>
                    <template #body="slotProps">
                        <span class="font-mono font-bold">{{ slotProps.data.code }}</span>
                    </template>
                </Column>

                <Column field="date" header="Tanggal" sortable>
                    <template #body="slotProps">
                        {{ formatDate(slotProps.data.date) }}
                    </template>
                </Column>

                <Column field="method" header="Pembayaran" sortable>
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.method" :severity="getSeverity(slotProps.data.method)" rounded />
                    </template>
                </Column>

                <Column field="total" header="Total Belanja" sortable class="text-right">
                    <template #body="slotProps">
                        <span class="font-bold text-surface-900 dark:text-surface-0">
                            {{ formatCurrency(slotProps.data.total) }}
                        </span>
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-surface-50 dark:bg-surface-900 border-t border-b border-surface-200 dark:border-surface-700">
                        <h5 class="font-bold mb-2 text-surface-500 text-xs uppercase tracking-wide">Rincian Barang</h5>
                        
                        <DataTable :value="slotProps.data.items" size="small" class="text-xs">
                            <Column field="productName" header="Nama Produk"></Column>
                            <Column field="qty" header="Qty" class="text-center"></Column>
                            <Column field="price" header="Harga Satuan" class="text-right">
                                <template #body="itemProps">
                                    {{ formatCurrency(itemProps.data.price) }}
                                </template>
                            </Column>
                            <Column field="subtotal" header="Subtotal" class="text-right font-bold">
                                <template #body="itemProps">
                                    {{ formatCurrency(itemProps.data.subtotal) }}
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </template>

            </DataTable>
        </div>
    </div>
</template>