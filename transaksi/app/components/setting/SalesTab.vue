<script setup>
defineProps({
    settings: { type: Object, required: true }
});
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

            <div v-if="settings.sale_tax_enabled" class="bg-surface-50 dark:bg-surface-100 p-4 rounded-xl border border-surface-200 dark:border-surface-700 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm text-surface-800 dark:text-surface-100">Izinkan Stok Minus</div>
                        <div class="text-xs text-surface-500">Kasir tetap bisa input barang meski stok 0.</div>
                    </div>
                    <InputSwitch v-model="settings.sale_allow_negative_stock" />
                </div>
                <div class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 transition-colors">
                    <div>
                        <div class="font-bold text-sm text-surface-800 dark:text-surface-100">Wajib Pilih Pelanggan</div>
                        <div class="text-xs text-surface-500">Transaksi tidak bisa diproses tanpa data pelanggan.</div>
                    </div>
                    <InputSwitch v-model="settings.sale_require_customer" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply dark:bg-surface-100 bg-surface-0 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6; }
.section-title { @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-4 pb-2 border-b border-surface-100 dark:border-surface-700; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>