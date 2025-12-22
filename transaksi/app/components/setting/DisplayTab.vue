<script setup>
defineProps({
    settings: { type: Object, required: true }
});
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Warna Utama Aplikasi</h3>
            <div class="field">
                <label>Pilih Warna Utama (Hex Code)</label>
                <div class="flex gap-4 items-center">
                    <ColorPicker v-model="settings.theme_primary_color" format="hex" class="!w-10 !h-10" />
                    <InputText v-model="settings.theme_primary_color" placeholder="#2563eb" class="w-40 !py-2.5 !text-sm font-mono" />
                </div>
                <small class="text-surface-500 mt-2 block">
                    *Catatan: Perubahan warna memerlukan refresh halaman untuk efek penuh.
                </small>
            </div>
        </div>

        <div class="card-section">
            <h3 class="section-title">Tata Letak Menu (Layout)</h3>
            <div class="field">
                <label class="mb-3 block">Pilih Mode Navigasi</label>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    
                    <div 
                        class="border rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden bg-surface-0 dark:bg-surface-800"
                        :class="settings.layout_mode === 'topbar' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-500' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'"
                        @click="settings.layout_mode = 'topbar'"
                    >
                        <div class="h-20 w-full bg-surface-100 dark:bg-surface-900 rounded border border-surface-300 dark:border-surface-600 flex flex-col shadow-sm overflow-hidden">
                            <div class="h-4 bg-primary-500 w-full"></div> 
                            <div class="flex-1 p-2 space-y-1">
                                <div class="w-1/2 h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                                <div class="w-3/4 h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                            </div>
                        </div>
                        <div>
                            <span class="font-bold text-sm block text-surface-900 dark:text-surface-100">Topbar</span>
                            <span class="text-xs text-surface-500 leading-tight block mt-1">Navigasi horizontal di atas. Klasik.</span>
                        </div>
                        <i v-if="settings.layout_mode === 'topbar'" class="pi pi-check-circle text-primary-600 absolute top-3 right-3 text-lg bg-surface-0 rounded-full"></i>
                    </div>

                    <div 
                        class="border rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden bg-surface-0 dark:bg-surface-800"
                        :class="settings.layout_mode === 'sidebar' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-500' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'"
                        @click="settings.layout_mode = 'sidebar'"
                    >
                        <div class="h-20 w-full bg-surface-100 dark:bg-surface-900 rounded border border-surface-300 dark:border-surface-600 flex shadow-sm overflow-hidden">
                            <div class="w-6 h-full bg-primary-500"></div> 
                            <div class="flex-1 p-2 space-y-1">
                                <div class="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                                <div class="w-2/3 h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                            </div>
                        </div>
                        <div>
                            <span class="font-bold text-sm block text-surface-900 dark:text-surface-100">Sidebar</span>
                            <span class="text-xs text-surface-500 leading-tight block mt-1">Menu vertikal di kiri. Area luas.</span>
                        </div>
                        <i v-if="settings.layout_mode === 'sidebar'" class="pi pi-check-circle text-primary-600 absolute top-3 right-3 text-lg bg-surface-0 rounded-full"></i>
                    </div>

                    <div 
                        class="border rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden bg-surface-0 dark:bg-surface-800"
                        :class="settings.layout_mode === 'tabs' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-500' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'"
                        @click="settings.layout_mode = 'tabs'"
                    >
                        <div class="h-20 w-full bg-surface-100 dark:bg-surface-900 rounded border border-surface-300 dark:border-surface-600 flex flex-col shadow-sm overflow-hidden">
                            <div class="flex-1 p-2 space-y-1">
                                <div class="w-1/2 h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                                <div class="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded"></div>
                            </div>
                            <div class="h-4 bg-primary-500 w-full flex justify-around items-center px-2"> 
                                <div class="w-2 h-2 rounded-full bg-white/50"></div>
                                <div class="w-2 h-2 rounded-full bg-white/50"></div>
                                <div class="w-2 h-2 rounded-full bg-white/50"></div>
                            </div>
                        </div>
                        <div>
                            <span class="font-bold text-sm block text-surface-900 dark:text-surface-100">Bottom Nav</span>
                            <span class="text-xs text-surface-500 leading-tight block mt-1">Menu di bawah. Ala Mobile App.</span>
                        </div>
                        <i v-if="settings.layout_mode === 'tabs'" class="pi pi-check-circle text-primary-600 absolute top-3 right-3 text-lg bg-surface-0 rounded-full"></i>
                    </div>

                    <div 
                        class="border rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 relative overflow-hidden bg-surface-0 dark:bg-surface-800"
                        :class="settings.layout_mode === 'multiwindow' ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-500' : 'border-surface-200 dark:border-surface-700 hover:border-primary-300'"
                        @click="settings.layout_mode = 'multiwindow'"
                    >
                        
                        <div class="h-20 w-full bg-surface-100 dark:bg-surface-900 rounded border border-surface-300 dark:border-surface-600 flex shadow-sm overflow-hidden">
                            <div class="w-4 h-full bg-surface-200 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-700 flex flex-col items-center pt-1 gap-1">
                                <div class="w-2 h-2 rounded bg-surface-400"></div>
                                <div class="w-2 h-2 rounded bg-surface-400"></div>
                            </div>
                            
                            <div class="flex-1 flex flex-col">
                                <div class="h-4 bg-surface-200 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700 flex items-end px-1 gap-1">
                                    <div class="h-3 w-5 bg-surface-300 dark:bg-surface-600 rounded-t-sm"></div>
                                    <div class="h-3 w-8 bg-surface-0 dark:bg-surface-500 rounded-t-sm border-t border-x border-surface-300 dark:border-surface-600 relative">
                                        <div class="absolute top-0 w-full h-0.5 bg-primary-500 rounded-t-sm"></div>
                                    </div>
                                    <div class="h-3 w-5 bg-surface-300 dark:bg-surface-600 rounded-t-sm"></div>
                                </div>
                                <div class="flex-1 p-2 bg-surface-0 dark:bg-surface-900">
                                    <div class="w-full h-1.5 bg-surface-100 dark:bg-surface-800 rounded mb-1"></div>
                                    <div class="w-1/2 h-1.5 bg-surface-100 dark:bg-surface-800 rounded"></div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <span class="font-bold text-sm block text-surface-900 dark:text-surface-100">Multi-Window</span>
                            <span class="text-xs text-surface-500 leading-tight block mt-1">Ala Visual Studio. Buka banyak menu dalam Tabs.</span>
                        </div>
                        <i v-if="settings.layout_mode === 'multiwindow'" class="pi pi-check-circle text-primary-600 absolute top-3 right-3 text-lg bg-surface-0 rounded-full"></i>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply dark:bg-surface-900 bg-surface-0 rounded-xl shadow-sm border border-surface-200 dark:border-surface-800 p-6; }
.section-title { @apply text-base font-bold text-surface-800 dark:text-surface-100 mb-4 pb-2 border-b border-surface-100 dark:border-surface-700; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>