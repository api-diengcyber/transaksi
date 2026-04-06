<script setup>
defineProps({
    settings: { type: Object, required: true }
});

// Pilihan template nota
const receiptTemplates = [
  {
    id: "thermal_standard",
    name: "Thermal Standard",
    description: "Format kasir thermal (58/80mm) klasik.",
    icon: "pi pi-receipt",
  },
  {
    id: "thermal_minimal",
    name: "Thermal Minimalis",
    description: "Format padat untuk menghemat kertas.",
    icon: "pi pi-align-center",
  },
  {
    id: "invoice_a4",
    name: "Faktur A4",
    description: "Invoice besar untuk transaksi B2B.",
    icon: "pi pi-file",
  },
];
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="section-title !mb-0">Pajak Penjualan (PPN)</h3>
                    <p class="text-xs text-surface-500 mt-1">Atur pajak pertambahan nilai otomatis.</p>
                </div>
                <InputSwitch v-model="settings.sale_tax_enabled" />
            </div>

            <div v-if="settings.sale_tax_enabled" class="bg-surface-50 p-4 rounded-xl border border-surface-200 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div class="field">
                    <label>Persentase Pajak (%)</label>
                    <InputNumber v-model="settings.sale_tax_percentage" suffix="%" :min="0" :max="100" showButtons class="w-full" />
                </div>
                <div class="field">
                    <label>Metode Perhitungan</label>
                    <SelectButton v-model="settings.sale_tax_method" :options="[{ label: 'Exclude', value: 'exclusive' }, { label: 'Include', value: 'inclusive' }]" optionLabel="label" optionValue="value" class="w-full text-xs" />
                </div>
            </div>
        </div>

        <div class="card-section">
            <h3 class="section-title">Kebijakan Stok & Pelanggan</h3>
            <div class="space-y-4">
                <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm">Izinkan Stok Minus</div>
                        <div class="text-xs text-surface-500">Kasir tetap bisa input barang meski stok 0.</div>
                    </div>
                    <InputSwitch v-model="settings.sale_allow_negative_stock" />
                </div>
                <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm">Wajib Pilih Pelanggan</div>
                        <div class="text-xs text-surface-500">Transaksi tidak bisa diproses tanpa data pelanggan.</div>
                    </div>
                    <InputSwitch v-model="settings.sale_require_customer" />
                </div>
            </div>
        </div>

        <div class="card-section">
            <h3 class="section-title">Pengaturan & Cetak Nota</h3>
            
            <div class="mb-6">
                <label class="text-xs font-bold text-surface-500 uppercase tracking-wide mb-3 block">Pilih Template Nota</label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div
                        v-for="template in receiptTemplates"
                        :key="template.id"
                        @click="settings.receipt_template = template.id"
                        class="relative border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col gap-2"
                        :class="settings.receipt_template === template.id ? 'border-primary-500 bg-primary-50' : 'border-surface-200 bg-white hover:border-primary-300'"
                    >
                        <div class="flex justify-between items-start">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="settings.receipt_template === template.id ? 'bg-primary-100 text-primary-600' : 'bg-surface-100 text-surface-500'">
                                <i :class="template.icon" class="text-lg"></i>
                            </div>
                            <i v-if="settings.receipt_template === template.id" class="pi pi-check-circle text-primary-500 text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-surface-900" :class="settings.receipt_template === template.id ? 'text-primary-700' : ''">
                                {{ template.name }}
                            </h4>
                            <p class="text-xs text-surface-500 mt-1">{{ template.description }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-surface-100">
                <div class="space-y-3">
                    <label class="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2 block">Informasi Tambahan</label>
                    <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                        <div>
                            <div class="font-bold text-sm">Cetak Nama Kasir</div>
                            <div class="text-xs text-surface-500">Tampilkan nama kasir yang melayani.</div>
                        </div>
                        <InputSwitch v-model="settings.receipt_show_cashier" />
                    </div>
                    <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                        <div>
                            <div class="font-bold text-sm">Cetak Info Pelanggan</div>
                            <div class="text-xs text-surface-500">Tampilkan nama dan kontak pelanggan.</div>
                        </div>
                        <InputSwitch v-model="settings.receipt_show_customer" />
                    </div>
                </div>

                <div class="space-y-4">
                    <label class="text-xs font-bold text-surface-500 uppercase tracking-wide mb-2 block">Teks Kustom Nota</label>
                    <div class="field">
                        <label class="!normal-case !text-sm !text-surface-900">Catatan Atas (Header)</label>
                        <Textarea v-model="settings.receipt_header_text" rows="2" placeholder="Cth: Buka 24 Jam - Cabang Utama" class="w-full text-sm" />
                    </div>
                    <div class="field">
                        <label class="!normal-case !text-sm !text-surface-900">Catatan Bawah (Footer)</label>
                        <Textarea v-model="settings.store_footer_msg" rows="2" placeholder="Cth: Barang yang sudah dibeli tidak dapat ditukar." class="w-full text-sm" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply bg-surface-0 rounded-xl shadow-sm border border-surface-200 p-6; }
.section-title { @apply text-base font-bold mb-4 pb-2 border-b border-surface-100; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>