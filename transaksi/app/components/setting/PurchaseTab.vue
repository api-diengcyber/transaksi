<script setup>
defineProps({
    settings: { type: Object, required: true }
});

// Pilihan Tipe Nomor Faktur Pembelian
const purchaseInvoiceTypeOptions = [
    { label: 'Otomatis System (Cth: BUY-123456789)', value: 'system' },
    { label: 'Nomor Urut (Cth: 00001, 00002)', value: 'numeric' },
    { label: 'Alphanumeric Random (Cth: X7Y9Z2)', value: 'alphanumeric' },
    { label: 'Custom Manual (Input Staf)', value: 'manual' }
];
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Konfigurasi Pembelian & Stok Masuk</h3>
            <div class="grid grid-cols-1 gap-4">
                <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm">Wajib Isi Supplier</div>
                        <div class="text-xs text-surface-500">Mencegah input stok masuk tanpa asal-usul (Nama Pemasok).</div>
                    </div>
                    <InputSwitch v-model="settings.buy_require_supplier" />
                </div>

                <div class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm">Otomatis Approve</div>
                        <div class="text-xs text-surface-500">Stok barang langsung bertambah saat faktur disimpan tanpa perlu persetujuan manual.</div>
                    </div>
                    <InputSwitch v-model="settings.buy_auto_approve" />
                </div>

                <div class="field mt-2">
                    <label>Jatuh Tempo Default (Hari)</label>
                    <InputNumber v-model="settings.buy_default_due_days" suffix=" Hari" class="w-full md:w-1/2" />
                    <small class="block text-surface-500 mt-1">Digunakan sebagai default tanggal jatuh tempo saat pembayaran Tempo/Kredit.</small>
                </div>
            </div>
        </div>

        <div class="card-section border-emerald-200 bg-emerald-50/20">
            <h3 class="section-title !text-emerald-700">Pengaturan Nomor Faktur Pembelian (PO)</h3>
            <p class="text-xs text-surface-500 mb-4 mt-[-10px]">Tentukan format penomoran nota barang masuk (Purchase Order).</p>
            
            <div class="space-y-5">
                <div class="field">
                    <label>Tipe Penomoran</label>
                    <Dropdown 
                        v-model="settings.purchase_invoice_number_type" 
                        :options="purchaseInvoiceTypeOptions" 
                        optionLabel="label" 
                        optionValue="value" 
                        placeholder="Pilih Tipe Penomoran PO" 
                        class="w-full" 
                    />
                </div>

                <div v-if="settings.purchase_invoice_number_type !== 'manual' && settings.purchase_invoice_number_type !== 'system'" class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-0 p-4 rounded-lg border border-surface-200">
                    <div class="field">
                        <label>Prefix (Awalan)</label>
                        <InputText v-model="settings.purchase_invoice_prefix" placeholder="Cth: PO-" class="w-full uppercase" />
                    </div>
                    <div class="field">
                        <label v-if="settings.purchase_invoice_number_type === 'numeric'">Digit Angka</label>
                        <label v-else>Panjang Karakter</label>
                        <InputNumber v-model="settings.purchase_invoice_length" placeholder="Cth: 5" class="w-full" :min="3" :max="15" />
                    </div>
                    <div class="field">
                        <label>Suffix (Akhiran)</label>
                        <InputText v-model="settings.purchase_invoice_suffix" placeholder="Cth: -SUP" class="w-full uppercase" />
                    </div>
                </div>

                <div class="p-3 bg-surface-100 rounded-lg text-sm border border-surface-200 flex items-center justify-between">
                    <span class="text-surface-600 font-semibold">Preview Format:</span>
                    <span class="font-mono font-bold text-emerald-700 bg-white px-3 py-1 rounded shadow-sm border border-emerald-100">
                        <template v-if="settings.purchase_invoice_number_type === 'system'">BUY-{{ new Date().getTime().toString().substring(5) }}</template>
                        <template v-else-if="settings.purchase_invoice_number_type === 'manual'">[Diinput Saat Kulakan]</template>
                        <template v-else>
                            {{ (settings.purchase_invoice_prefix || '').toUpperCase() }}<span v-if="settings.purchase_invoice_number_type === 'numeric'">{{ '0'.repeat((settings.purchase_invoice_length || 5) - 1) }}1</span><span v-else>{{ 'A1B2C3D4'.substring(0, (settings.purchase_invoice_length || 6)) }}</span>{{ (settings.purchase_invoice_suffix || '').toUpperCase() }}
                        </template>
                    </span>
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