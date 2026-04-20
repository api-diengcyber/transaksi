<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth.store';
import { useJournalService } from '~/composables/useJournalService';

// Gunakan layout kosong agar tidak ada navbar/sidebar yang ikut tercetak
definePageMeta({ layout: 'empty' }); 

const route = useRoute();
const authStore = useAuthStore();
const journalService = useJournalService();

const transaction = ref(null);
const loading = ref(true);

// Ambil pengaturan nota dari store
const templateMode = computed(() => authStore.getSetting('receipt_template', 'thermal_standard'));
const showCashier = computed(() => authStore.getSetting('receipt_show_cashier', true));
const showCustomer = computed(() => authStore.getSetting('receipt_show_customer', true));
const headerText = computed(() => authStore.getSetting('receipt_header_text', ''));
const footerText = computed(() => authStore.getSetting('store_footer_msg', 'Terima kasih atas kunjungan Anda.'));

const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val) || 0);
const formatDate = (dateString) => new Date(dateString).toLocaleString('id-ID');

onMounted(async () => {
    try {
        const res = await journalService.getTransactionById(route.params.uuid);
        const rawData = res?.data || res;
        
        // PARSE STRUKTUR JURNAL (KEY-VALUE) KE OBJECT TRANSAKSI
        if (rawData && rawData.journal && rawData.details) {
            const j = rawData.journal;
            const d = rawData.details;

            // Fungsi bantu untuk mencari value berdasarkan key
            const getVal = (keyName) => d.find(x => x.key === keyName)?.value;

            // Ekstrak item keranjang (Looping berdasarkan total_items)
            const totalItems = Number(getVal('total_items') || 0);
            const items = [];

            for(let i = 0; i < totalItems; i++) {
                items.push({
                    item_name: getVal(`item_name#${i}`),
                    qty: Number(getVal(`qty#${i}`) || 0),
                    unit_name: getVal(`unit_name#${i}`),
                    price: Number(getVal(`price#${i}`) || 0),
                    subtotal: Number(getVal(`subtotal#${i}`) || 0),
                });
            }

            // Gabungkan menjadi format yang mudah dirender template
            transaction.value = {
                invoice_number: getVal('invoice_code') || j.code,
                created_at: j.createdAt,
                customer_name: getVal('customer_name') || 'Umum',
                payment_method: getVal('payment_method'),
                grand_total: Number(getVal('grand_total') || 0),
                amount_cash: Number(getVal('amount_cash') || 0),
                due_date: getVal('due_date'),
                items: items
            };
        }

        // Otomatis buka dialog print setelah render selesai
        setTimeout(() => {
            window.print();
        }, 2000);
    } catch (e) {
        console.error("Gagal memuat transaksi", e);
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div v-if="loading" class="flex justify-center items-center h-screen text-surface-500 font-mono">
        Memuat Nota...
    </div>

    <div v-else-if="!transaction" class="flex justify-center items-center h-screen text-red-500 font-bold">
        Gagal merender data nota. Transaksi tidak ditemukan atau format tidak sesuai.
    </div>

    <div v-else class="receipt-container" :class="templateMode === 'invoice_a4' ? 'w-full max-w-4xl p-8' : 'w-full max-w-[80mm] p-4'">
        
        <div class="text-center mb-4">
            <h1 class="font-bold text-xl uppercase">{{ authStore.activeStore?.name || 'Dieng Cyber' }}</h1>
            <p v-if="authStore.activeStore?.address" class="text-xs">{{ authStore.activeStore.address }}</p>
            <p v-if="authStore.activeStore?.phone" class="text-xs">Telp: {{ authStore.activeStore.phone }}</p>
            <p v-if="headerText" class="text-xs mt-1 border-t border-dashed border-black pt-1">{{ headerText }}</p>
        </div>

        <div class="border-t-2 border-dashed border-black my-2"></div>

        <div class="text-xs mb-3 space-y-1">
            <div class="flex justify-between"><span>No:</span> <span>{{ transaction.invoice_number }}</span></div>
            <div class="flex justify-between"><span>Tgl:</span> <span>{{ formatDate(transaction.created_at) }}</span></div>
            <div v-if="showCashier" class="flex justify-between"><span>Kasir:</span> <span>{{ authStore.user?.name || 'Admin' }}</span></div>
            <div v-if="showCustomer" class="flex justify-between"><span>Pelanggan:</span> <span>{{ transaction.customer_name }}</span></div>
        </div>

        <div class="border-t-2 border-dashed border-black my-2"></div>

        <div v-if="templateMode.includes('thermal')">
            <div v-for="(item, index) in transaction.items" :key="index" class="text-xs mb-2">
                <div class="font-bold">{{ item.item_name }}</div>
                <div class="flex justify-between">
                    <span>{{ item.qty }} {{ item.unit_name }} x {{ formatCurrency(item.price) }}</span>
                    <span>{{ formatCurrency(item.subtotal) }}</span>
                </div>
            </div>
        </div>

        <table v-if="templateMode === 'invoice_a4'" class="w-full text-sm mb-4 border-collapse">
            <thead>
                <tr class="border-b-2 border-black">
                    <th class="text-left py-1">Produk</th>
                    <th class="text-center py-1">Qty</th>
                    <th class="text-right py-1">Harga</th>
                    <th class="text-right py-1">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(item, index) in transaction.items" :key="index" class="border-b border-gray-300">
                    <td class="py-1">{{ item.item_name }}</td>
                    <td class="text-center py-1">{{ item.qty }} {{ item.unit_name }}</td>
                    <td class="text-right py-1">{{ formatCurrency(item.price) }}</td>
                    <td class="text-right py-1">{{ formatCurrency(item.subtotal) }}</td>
                </tr>
            </tbody>
        </table>

        <div class="border-t-2 border-dashed border-black my-2"></div>

        <div class="text-xs space-y-1">
            <div class="flex justify-between font-bold"><span>Total:</span> <span>{{ formatCurrency(transaction.grand_total) }}</span></div>
            
            <template v-if="transaction.payment_method === 'CASH'">
                <div class="flex justify-between"><span>Tunai:</span> <span>{{ formatCurrency(transaction.amount_cash) }}</span></div>
                <div class="flex justify-between"><span>Kembali:</span> <span>{{ formatCurrency(transaction.amount_cash - transaction.grand_total) }}</span></div>
            </template>
            
            <template v-else-if="transaction.payment_method === 'CREDIT'">
                <div class="flex justify-between text-black"><span>DP (Tunai):</span> <span>{{ formatCurrency(transaction.amount_cash) }}</span></div>
                <div class="flex justify-between text-black"><span>Sisa Piutang:</span> <span>{{ formatCurrency(transaction.grand_total - transaction.amount_cash) }}</span></div>
                <div class="flex justify-between italic mt-1"><span>Jatuh Tempo:</span> <span>{{ transaction.due_date ? formatDate(transaction.due_date).split(',')[0] : '-' }}</span></div>
            </template>
        </div>

        <div class="border-t-2 border-dashed border-black my-2"></div>

        <div class="text-center text-[10px] mt-4">
            <p>{{ footerText }}</p>
            <p class="mt-1 opacity-50">Powered by Dieng Cyber</p>
        </div>
    </div>
</template>

<style>
@media print {
    @page { margin: 0; }
    body { margin: 0; background-color: white !important; color: black !important; }
    nav, header, footer, .no-print { display: none !important; }
}
.receipt-container { margin: 0 auto; background: white; color: black; font-family: 'Courier New', Courier, monospace; }
</style>