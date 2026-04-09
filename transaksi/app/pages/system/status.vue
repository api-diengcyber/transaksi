<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

definePageMeta({ layout: 'blank' });

const storeService = useStoreService();
const config = useRuntimeConfig();
const router = useRouter();

// State
const loading = ref(true);
const statusData = ref({
    apiConnection: 'PENDING', // PENDING, SUCCESS, ERROR
    dbConnection: 'PENDING',
    storeInstalled: 'PENDING',
    pingTime: 0,
    message: 'Memulai pengecekan sistem...'
});

const checkSystem = async () => {
    loading.value = true;
    const startTime = Date.now();
    
    try {
        statusData.value.message = 'Menghubungi API Server...';
        
        // 1. Coba hubungi endpoint setup status (Mewakili API & DB)
        const response = await storeService.getSetupStatus();
        const data = response?.data || response;
        
        statusData.value.apiConnection = 'SUCCESS';
        statusData.value.dbConnection = 'SUCCESS'; // Asumsi: Jika setup status jalan, DB jalan
        statusData.value.storeInstalled = data.exists ? 'SUCCESS' : 'WARNING';
        
        statusData.value.message = data.exists 
            ? 'Sistem berjalan normal. Database terhubung dan toko telah diinstal.'
            : 'Database terhubung, namun toko belum diinstal.';

    } catch (error) {
        statusData.value.apiConnection = 'ERROR';
        statusData.value.dbConnection = 'ERROR';
        statusData.value.storeInstalled = 'ERROR';
        
        if (error.response) {
            statusData.value.message = `Database Error atau Konfigurasi Salah (Code: ${error.response.status})`;
            statusData.value.apiConnection = 'SUCCESS'; // API Nyala tapi DB/Logik error
        } else {
            statusData.value.message = 'API Server tidak dapat dihubungi. Pastikan backend berjalan (NestJS).';
        }
    } finally {
        statusData.value.pingTime = Date.now() - startTime;
        loading.value = false;
    }
};

onMounted(() => {
    // Beri jeda sedikit agar efek UI terlihat
    setTimeout(checkSystem, 800);
});
</script>

<template>
    <div class="min-h-screen bg-surface-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <div class="w-full max-w-lg bg-surface-0 rounded-3xl shadow-xl border border-surface-200 relative z-10 overflow-hidden">
            
            <div class="bg-slate-900 text-white p-6 flex items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold flex items-center gap-2">
                        <i class="pi pi-shield"></i> Diagnostik Sistem
                    </h1>
                    <p class="text-xs text-slate-400 mt-1 font-mono">Terminal Pengecekan</p>
                </div>
                <div class="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                    <i class="pi pi-desktop text-xl text-emerald-400 animate-pulse" v-if="loading"></i>
                    <i class="pi pi-check text-xl text-emerald-400" v-else-if="statusData.apiConnection === 'SUCCESS'"></i>
                    <i class="pi pi-times text-xl text-red-400" v-else></i>
                </div>
            </div>

            <div class="p-6 md:p-8 flex flex-col gap-6">
                
                <div class="flex flex-col gap-4">
                    
                    <div class="flex items-center justify-between p-4 rounded-xl border" :class="statusData.apiConnection === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100' : (statusData.apiConnection === 'ERROR' ? 'bg-red-50 border-red-100' : 'bg-surface-50 border-surface-200')">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="statusData.apiConnection === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : (statusData.apiConnection === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-surface-200 text-surface-500')">
                                <i class="pi pi-globe text-sm"></i>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-surface-800">API Server (Backend)</div>
                                <div class="text-[10px] text-surface-500 font-mono">{{ config.public.apiBase || 'http://localhost:3001' }}</div>
                            </div>
                        </div>
                        <div>
                            <i class="pi pi-spin pi-spinner text-surface-400" v-if="statusData.apiConnection === 'PENDING'"></i>
                            <span v-else-if="statusData.apiConnection === 'SUCCESS'" class="text-xs font-bold text-emerald-600 uppercase">Terhubung</span>
                            <span v-else class="text-xs font-bold text-red-600 uppercase">Gagal</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between p-4 rounded-xl border" :class="statusData.dbConnection === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100' : (statusData.dbConnection === 'ERROR' ? 'bg-red-50 border-red-100' : 'bg-surface-50 border-surface-200')">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="statusData.dbConnection === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : (statusData.dbConnection === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-surface-200 text-surface-500')">
                                <i class="pi pi-database text-sm"></i>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-surface-800">Database (SQL)</div>
                                <div class="text-[10px] text-surface-500 font-mono">Koneksi & Query</div>
                            </div>
                        </div>
                        <div>
                            <i class="pi pi-spin pi-spinner text-surface-400" v-if="statusData.dbConnection === 'PENDING'"></i>
                            <span v-else-if="statusData.dbConnection === 'SUCCESS'" class="text-xs font-bold text-emerald-600 uppercase">Terhubung</span>
                            <span v-else class="text-xs font-bold text-red-600 uppercase">Gagal</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between p-4 rounded-xl border" :class="statusData.storeInstalled === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100' : (statusData.storeInstalled === 'WARNING' ? 'bg-amber-50 border-amber-100' : (statusData.storeInstalled === 'ERROR' ? 'bg-red-50 border-red-100' : 'bg-surface-50 border-surface-200'))">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="statusData.storeInstalled === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : (statusData.storeInstalled === 'WARNING' ? 'bg-amber-100 text-amber-600' : (statusData.storeInstalled === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-surface-200 text-surface-500'))">
                                <i class="pi pi-shop text-sm"></i>
                            </div>
                            <div>
                                <div class="text-sm font-bold text-surface-800">Status Instalasi Toko</div>
                                <div class="text-[10px] text-surface-500 font-mono">Setup Awal</div>
                            </div>
                        </div>
                        <div>
                            <i class="pi pi-spin pi-spinner text-surface-400" v-if="statusData.storeInstalled === 'PENDING'"></i>
                            <span v-else-if="statusData.storeInstalled === 'SUCCESS'" class="text-xs font-bold text-emerald-600 uppercase">Selesai</span>
                            <span v-else-if="statusData.storeInstalled === 'WARNING'" class="text-xs font-bold text-amber-600 uppercase">Belum Diinstal</span>
                            <span v-else class="text-xs font-bold text-red-600 uppercase">Gagal Cek</span>
                        </div>
                    </div>

                </div>

                <div class="bg-slate-900 rounded-xl p-4 font-mono text-[10px] leading-relaxed shadow-inner">
                    <div class="text-slate-500 mb-2"># System Log Output</div>
                    <div v-if="loading" class="text-emerald-400">Menjalankan diagnostik...</div>
                    <div v-else>
                        <div class="text-emerald-400">> Diagnostik selesai dalam {{ statusData.pingTime }}ms.</div>
                        <div class="mt-1" :class="statusData.apiConnection === 'ERROR' || statusData.dbConnection === 'ERROR' ? 'text-red-400 font-bold' : 'text-slate-300'">> {{ statusData.message }}</div>
                    </div>
                </div>

            </div>

            <div class="p-6 border-t border-surface-100 bg-surface-50 flex justify-between items-center">
                <Button 
                    label="Periksa Ulang" 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    outlined 
                    size="small" 
                    @click="checkSystem" 
                    :loading="loading" 
                    class="!font-bold !text-xs"
                />
                
                <Button 
                    v-if="statusData.storeInstalled === 'WARNING'"
                    label="Mulai Install" 
                    icon="pi pi-play" 
                    iconPos="right"
                    severity="warning" 
                    size="small" 
                    @click="router.push('/install')" 
                    class="!font-bold !text-xs shadow-md"
                />
                <Button 
                    v-else
                    label="Kembali ke Login" 
                    icon="pi pi-arrow-right" 
                    iconPos="right"
                    severity="primary" 
                    size="small" 
                    @click="router.push('/login')" 
                    class="!font-bold !text-xs shadow-md"
                />
            </div>
            
        </div>
    </div>
</template>