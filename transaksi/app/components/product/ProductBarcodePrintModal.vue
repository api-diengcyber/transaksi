<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const props = defineProps({
    visible: Boolean,
    selectedProducts: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:visible']);

// Daftar produk yang akan dicetak beserta input 'copies'
const printList = ref([]);

watch(() => props.visible, (val) => {
    if (val && props.selectedProducts) {
        // Salin data dan tambahkan properti 'copies' dengan default 1 lembar
        printList.value = props.selectedProducts.map(p => ({
            ...p,
            copies: 1
        }));
    }
});

const close = () => {
    emit('update:visible', false);
};

const processPrint = () => {
    // 1. Simpan data yang sudah di-adjust jumlahnya ke localStorage
    localStorage.setItem('bulk_print_barcodes', JSON.stringify(printList.value));
    
    const url = router.resolve(`/product/print-barcode`).href;

    // 2. Buka halaman cetak di Tab Baru
    window.open(url, '_blank');
    
    // 3. Tutup Modal
    close();
};
</script>

<template>
    <Dialog :visible="visible" @update:visible="(val) => emit('update:visible', val)" modal header="Pengaturan Cetak Barcode" :style="{ width: '600px' }">
        <p class="text-sm text-surface-500 mb-4">Tentukan berapa lembar barcode yang ingin dicetak untuk masing-masing produk yang Anda pilih.</p>
        
        <div class="max-h-[60vh] overflow-y-auto">
            <DataTable :value="printList" class="p-datatable-sm" responsiveLayout="scroll">
                <Column field="name" header="Nama Produk">
                    <template #body="{ data }">
                        <div class="font-bold text-sm">{{ data.name }}</div>
                        <div class="text-[10px] text-surface-500">{{ data.code || data.sku }}</div>
                    </template>
                </Column>
                <Column header="Jml. Cetak" style="width: 140px">
                    <template #body="{ data }">
                        <div class="flex items-center bg-surface-100 rounded-lg border border-surface-200 h-8 w-24">
                            <button class="w-8 h-full flex items-center justify-center hover:bg-surface-200 rounded-l-lg text-surface-600" @click="data.copies > 1 ? data.copies-- : null"><i class="pi pi-minus text-[10px]"></i></button>
                            <input v-model="data.copies" type="number" class="w-full h-full bg-transparent text-center text-sm font-bold border-none outline-none appearance-none m-0 p-0 focus:ring-0" min="1" />
                            <button class="w-8 h-full flex items-center justify-center hover:bg-surface-200 rounded-r-lg text-primary-600" @click="data.copies++"><i class="pi pi-plus text-[10px]"></i></button>
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <template #footer>
            <Button label="Batal" icon="pi pi-times" text @click="close" />
            <Button label="Buka Layar Cetak" icon="pi pi-print" severity="primary" @click="processPrint" />
        </template>
    </Dialog>
</template>