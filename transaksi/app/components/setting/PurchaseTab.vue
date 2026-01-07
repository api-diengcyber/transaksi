<script setup>
defineProps({
    settings: { type: Object, required: true }
});
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Konfigurasi Pembelian</h3>
            <div class="grid grid-cols-1 gap-4">
                <div class="flex items-center justify-between p-3 border border-surface-200  rounded-lg">
                    <div>
                        <div class="font-bold text-sm">Wajib Isi Supplier</div>
                        <div class="text-xs text-surface-500">Mencegah input stok masuk tanpa asal-usul.</div>
                    </div>
                    <InputSwitch v-model="settings.buy_require_supplier" />
                </div>

                <div class="flex items-center justify-between p-3 border border-surface-200  rounded-lg">
                    <div>
                        <div class="font-bold text-sm">Otomatis Approve</div>
                        <div class="text-xs text-surface-500">Stok langsung bertambah tanpa perlu persetujuan.</div>
                    </div>
                    <InputSwitch v-model="settings.buy_auto_approve" />
                </div>

                <div class="field mt-2">
                    <label>Jatuh Tempo Default (Hari)</label>
                    <InputNumber v-model="settings.buy_default_due_days" suffix=" Hari" class="w-full md:w-1/2" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply bg-surface-0 rounded-xl shadow-sm border border-surface-200  p-6; }
.section-title { @apply text-base font-bold  mb-4 pb-2 border-b border-surface-100 ; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>