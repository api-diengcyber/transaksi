<script setup>
// Menerima prop settings dari komponen induk (index.vue)
const props = defineProps({
    settings: {
        type: Object,
        required: true
    }
});
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <div class="bg-white p-5 rounded-2xl border border-surface-200 shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <i class="pi pi-file-edit text-xl"></i>
                </div>
                <div>
                    <div class="font-bold text-surface-900">Gunakan Nomor Faktur Otomatis</div>
                    <p class="text-sm text-surface-500 m-0">Jika aktif, sistem akan men-generate nomor faktur otomatis untuk setiap piutang baru.</p>
                </div>
            </div>
            <InputSwitch v-model="settings.ar_use_invoice_number" />
        </div>
    </div>
</template>