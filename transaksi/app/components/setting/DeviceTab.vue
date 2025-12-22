<script setup>
defineProps({
    settings: { type: Object, required: true }
});
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Pengaturan Printer Struk</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="field">
                    <label>Ukuran Kertas</label>
                    <div class="flex gap-4 mt-1">
                        <div class="flex align-items-center">
                            <RadioButton v-model="settings.dev_printer_width" inputId="p58" name="paper" value="58mm" />
                            <label for="p58" class="ml-2 text-sm">58mm</label>
                        </div>
                        <div class="flex align-items-center">
                            <RadioButton v-model="settings.dev_printer_width" inputId="p80" name="paper" value="80mm" />
                            <label for="p80" class="ml-2 text-sm">80mm</label>
                        </div>
                    </div>
                </div>
                <div class="field">
                    <label>Opsi Cetak</label>
                    <div class="flex flex-col gap-2 mt-1">
                        <div class="flex align-items-center">
                            <Checkbox v-model="settings.dev_auto_print_receipt" binary inputId="autoprint" />
                            <label for="autoprint" class="ml-2 text-sm">Otomatis Print</label>
                        </div>
                        <div class="flex align-items-center">
                            <Checkbox v-model="settings.dev_show_logo_receipt" binary inputId="showlogo" />
                            <label for="showlogo" class="ml-2 text-sm">Tampilkan Logo</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply dark:bg-surface-400 bg-surface-0 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6; }
.section-title { @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-4 pb-2 border-b border-surface-100 dark:border-surface-700; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>