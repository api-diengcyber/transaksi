<script setup>
const props = defineProps({
    settings: { type: Object, required: true },
    loading: { type: Boolean, default: false }
});
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Pengaturan Sinkronisasi Data</h3>
            
            <div class="flex flex-col gap-6">
                <div class="flex items-center justify-between p-4 rounded-lg border border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-100/50">
                    <div class="flex gap-4 items-center">
                        <div class="w-10 h-10 rounded-full bg-surface-0 dark:bg-surface-700 flex items-center justify-center shadow-sm text-primary-600 shrink-0">
                            <i class="pi pi-sync text-lg"></i>
                        </div>
                        <div>
                            <label class="text-sm font-bold text-surface-900 dark:text-surface-0 block">Aktifkan Sinkronisasi</label>
                            <p class="text-xs text-surface-500 mt-0.5">Izinkan aplikasi mengirim & menerima data ke server pusat secara realtime.</p>
                        </div>
                    </div>
                    <InputSwitch v-model="props.settings.sync_enabled" :disabled="loading" />
                </div>

                <div v-if="props.settings.sync_enabled" class="space-y-6 animate-fade-in">
                    
                    <div class="field">
                        <label>Pilih Mode Sinkronisasi</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                            
                            <div @click="!loading && (props.settings.sync_mode = 'automatic')"
                                 class="relative cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex items-start gap-3"
                                 :class="props.settings.sync_mode === 'automatic' 
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' 
                                    : 'border-surface-200 dark:border-surface-700 hover:border-primary-200 dark:hover:border-primary-700 bg-surface-0 dark:bg-surface-100'">
                                
                                <div class="mt-0.5">
                                    <RadioButton v-model="props.settings.sync_mode" inputId="mode_auto" value="automatic" :disabled="loading" class="pointer-events-none" />
                                </div>
                                <div>
                                    <span class="block text-sm font-bold mb-1" :class="props.settings.sync_mode === 'automatic' ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-200'">
                                        <i class="pi pi-cloud mr-1"></i> Otomatis
                                    </span>
                                    <p class="text-xs text-surface-500 leading-relaxed">
                                        Menggunakan server default (cloud pusat). Tidak perlu konfigurasi tambahan.
                                    </p>
                                </div>
                            </div>

                            <div @click="!loading && (props.settings.sync_mode = 'manual')"
                                 class="relative cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md flex items-start gap-3"
                                 :class="props.settings.sync_mode === 'manual' 
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500' 
                                    : 'border-surface-200 dark:border-surface-700 hover:border-primary-200 dark:hover:border-primary-700 bg-surface-0 dark:bg-surface-100'">
                                
                                <div class="mt-0.5">
                                    <RadioButton v-model="props.settings.sync_mode" inputId="mode_manual" value="manual" :disabled="loading" class="pointer-events-none" />
                                </div>
                                <div>
                                    <span class="block text-sm font-bold mb-1" :class="props.settings.sync_mode === 'manual' ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-200'">
                                        <i class="pi pi-cog mr-1"></i> Manual / Custom
                                    </span>
                                    <p class="text-xs text-surface-500 leading-relaxed">
                                        Tentukan alamat server tujuan sendiri. Cocok untuk private server / local network.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div v-if="props.settings.sync_mode === 'manual'" class="field animate-fade-in bg-surface-50 dark:bg-surface-100/50 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
                        <label>URL Endpoint Server</label>
                        <div class="p-inputgroup mt-1">
                            <span class="p-inputgroup-addon bg-surface-0 dark:bg-surface-700 text-surface-500">
                                <i class="pi pi-link text-sm"></i>
                            </span>
                            <span class="p-inputgroup-addon bg-surface-0 dark:bg-surface-700 text-surface-600 font-mono text-xs"></span>
                            <InputText v-model="props.settings.sync_url" placeholder="https://api.domain-anda.com/v1/sync" class="w-full font-mono text-sm" :disabled="loading" />
                        </div>
                        <div class="flex items-center gap-2 mt-2 text-xs text-surface-500">
                            <i class="pi pi-info-circle text-primary-500"></i>
                            <span>Pastikan endpoint dapat diakses dari jaringan ini.</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply dark:bg-surface-100 bg-surface-0 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6; }
.section-title { @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-6 pb-2 border-b border-surface-100 dark:border-surface-700; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>