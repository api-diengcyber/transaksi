<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';

const config = useRuntimeConfig();
const toast = useToast();
const loading = ref(false);
const updating = ref(false);
const updateInfo = ref(null);
const currentVersion = computed(() => `v${config.public.appVersion}`);

const checkUpdate = async () => {
    loading.value = true;
    try {
        const response = await useApi('/system-update/check', {
            method: 'GET'
        });
        updateInfo.value = response.data || response;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal mengecek update', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const runUpgrade = async () => {
    if (!updateInfo.value?.zipUrl) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Link download ZIP tidak ditemukan' });
        return;
    }

    updating.value = true;
    try {
        const res = await useApi('/system-update/upgrade', {
            method: 'POST',
            body: {
                zipUrl: updateInfo.value.zipUrl,
                version: updateInfo.value.version,
            }
        });
        
        toast.add({ 
            severity: 'success', 
            summary: 'Berhasil', 
            detail: 'File berhasil diekstrak. Aplikasi akan restart otomatis.', 
            life: 10000 
        });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Update Gagal', detail: 'Cek koneksi server Anda.', life: 5000 });
    } finally {
        updating.value = false;
    }
};

onMounted(() => {
    checkUpdate();
});
</script>

<template>
    <div class="p-6 max-w-4xl mx-auto">
        <div class="bg-surface-0 p-8 rounded-3xl shadow-xl border border-surface-100">
            <div class="flex items-center gap-4 mb-8">
                <div class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600">
                    <i class="pi pi-cloud-download text-3xl"></i>
                </div>
                <div>
                    <h1 class="text-2xl font-black text-surface-900">Pembaruan Sistem</h1>
                    <p class="text-surface-500 text-sm">Pastikan aplikasi selalu menggunakan versi terbaru untuk keamanan.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="p-4 rounded-2xl bg-surface-50 border border-surface-100">
                    <span class="text-xs font-bold text-surface-400 uppercase tracking-widest block mb-1">Versi Terpasang</span>
                    <div class="text-xl font-black text-surface-700">{{ currentVersion }}</div>
                </div>
                <div class="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                    <span class="text-xs font-bold text-primary-400 uppercase tracking-widest block mb-1">Versi Terbaru</span>
                    <div class="text-xl font-black text-primary-700">
                        {{ updateInfo ? updateInfo.version : 'Menghubungkan...' }}
                    </div>
                </div>
            </div>

            <div v-if="updateInfo" class="mb-8">
                <h3 class="font-bold text-surface-800 mb-2">Catatan Rilis ({{ updateInfo.version }}):</h3>
                <div class="p-4 bg-surface-50 rounded-xl text-sm text-surface-600 leading-relaxed border border-surface-100 whitespace-pre-line">
                    {{ updateInfo.description }}
                </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
                <Button 
                    label="Periksa Ulang" 
                    icon="pi pi-refresh" 
                    outlined 
                    severity="secondary" 
                    @click="checkUpdate" 
                    :loading="loading" 
                />
                
                <Button 
                    v-if="updateInfo && updateInfo.version !== currentVersion"
                    label="UPDATE SEKARANG" 
                    icon="pi pi-arrow-up-right" 
                    class="flex-1 font-bold shadow-lg shadow-primary-500/30" 
                    :loading="updating"
                    @click="runUpgrade"
                />
                
                <div v-else-if="updateInfo" class="flex-1 flex items-center justify-center bg-green-50 text-green-600 rounded-xl border border-green-100 px-4 py-2 text-sm font-bold">
                    <i class="pi pi-check-circle mr-2"></i> Aplikasi sudah dalam versi terbaru.
                </div>
            </div>

            <div class="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <i class="pi pi-exclamation-triangle text-amber-600 mt-1"></i>
                <p class="text-xs text-amber-700 leading-relaxed">
                    <strong>Peringatan:</strong> Proses update akan mengunduh file baru dari GitHub dan melakukan build ulang. 
                    Aplikasi mungkin tidak dapat diakses selama 1-2 menit selama proses build berlangsung.
                </p>
            </div>
        </div>
    </div>
</template>