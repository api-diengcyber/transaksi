<script setup>
import { ref, onMounted, nextTick } from 'vue';
import JsBarcode from 'jsbarcode';

// Gunakan layout kosong agar tidak ada sidebar/header
definePageMeta({ layout: 'blank' });

const printItems = ref([]);

onMounted(async () => {
    // 1. Ambil data produk yang akan dicetak dari localStorage
    const storedData = localStorage.getItem('bulk_print_barcodes');
    if (storedData) {
        printItems.value = JSON.parse(storedData);
        
        // 2. Generate Barcode ke elemen SVG
        await nextTick();
        generateBarcodes();
        
        // 3. Otomatis memanggil dialog Print Browser setelah 1 detik
        setTimeout(() => {
            window.print();
        }, 1000);
    }
});

const generateBarcodes = () => {
    printItems.value.forEach(item => {
        // Loop sebanyak jumlah cetak yang diminta (copies)
        for (let i = 0; i < item.copies; i++) {
            const elementId = `#barcode-${item.uuid}-${i}`;
            const barcodeValue = item.code || item.sku || item.uuid.substring(0, 8);
            
            try {
                JsBarcode(elementId, barcodeValue, {
                    format: "CODE128",
                    width: 1.5,
                    height: 40,
                    displayValue: true,
                    fontSize: 12,
                    margin: 5
                });
            } catch (e) {
                console.error("Gagal membuat barcode", e);
            }
        }
    });
};

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);
</script>

<template>
    <div class="print-container">
        <div class="no-print p-4 bg-blue-50 text-blue-700 text-center font-bold border-b border-blue-200">
            Menyiapkan dokumen cetak... Jika dialog print tidak muncul, tekan CTRL+P.
        </div>
        
        <div class="label-grid">
            <template v-for="(item, index) in printItems" :key="index">
                <div v-for="n in item.copies" :key="n" class="label-item">
                    <div class="text-[10px] font-bold uppercase truncate px-1">{{ item.name }}</div>
                    <svg :id="`barcode-${item.uuid}-${n-1}`" class="w-full max-h-12 mt-1"></svg>
                    <div class="text-[11px] font-black text-surface-800 mt-1">{{ formatCurrency(item.price || item.sellPrice) }}</div>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
/* Pengaturan CSS Khusus untuk Layout Cetak (Print) */
.label-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr); /* 3 Kolom */
    gap: 10px; /* Jarak antar stiker */
    padding: 10px;
}

.label-item {
    border: 1px dashed #ccc;
    padding: 8px 4px;
    text-align: center;
    border-radius: 4px;
    display: flex;
    /* flex-col; */
    justify-content: center;
    align-items: center;
    page-break-inside: avoid; /* Mencegah stiker terpotong di tengah halaman */
}

@media print {
    @page { margin: 5mm; } /* Margin kertas */
    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .label-item { border: none; } /* Hilangkan garis putus-putus saat dicetak asli */
}
</style>