<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'blank' });

const router = useRouter();
const systemService = useSystemService();
const toast = useToast();

const logs = ref('');
const loading = ref(true);
const logContainer = ref(null); // Reference untuk auto-scroll ke bawah

// --- FUNGSI MENGAMBIL LOG DARI API ---
const fetchLogs = async () => {
    loading.value = true;
    try {
        const response = await systemService.getLogs();
        logs.value = response?.data || response || 'Log kosong.';
        
        // Auto scroll ke paling bawah (log terbaru)
        nextTick(() => {
            if (logContainer.value) {
                logContainer.value.scrollTop = logContainer.value.scrollHeight;
            }
        });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Tidak dapat memuat log dari server', life: 3000 });
        logs.value = 'Gagal memuat log.';
    } finally {
        loading.value = false;
    }
};

// --- FUNGSI DOWNLOAD LOG MENJADI FILE .TXT ---
const downloadLogs = () => {
    if (!logs.value || logs.value === 'Log kosong.' || logs.value === 'Gagal memuat log.') {
        toast.add({ severity: 'warn', summary: 'Kosong', detail: 'Tidak ada log untuk diunduh.', life: 2000 });
        return;
    }

    // Membuat file Blob dari string log
    const blob = new Blob([logs.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Format nama file: api-logs-YYYY-MM-DD.txt
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `api-logs-${dateStr}.txt`;

    // Trigger Download Otomatis
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Bersihkan memory
    URL.revokeObjectURL(url);
};

// --- FUNGSI BERSIHKAN TAMPILAN (Clear Terminal) ---
const clearView = () => {
    logs.value = '';
};

onMounted(() => {
    fetchLogs();
});
</script>

<template>
    <div class="min-h-screen bg-surface-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
        <Toast />
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div class="w-full max-w-5xl bg-surface-0 rounded-3xl shadow-xl border border-surface-200 relative z-10 overflow-hidden flex flex-col h-[85vh] sm:h-[90vh]">
            
            <div class="bg-slate-900 text-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                    <div class="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center shadow-inner shrink-0">
                        <i class="pi pi-server text-xl text-primary-400"></i>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold">Sistem Log & Activity</h1>
                        <p class="text-[11px] text-slate-400 mt-1 font-mono">Pantau aktivitas, request, dan error API secara real-time</p>
                    </div>
                </div>

                <div class="flex gap-2">
                    <Button icon="pi pi-trash" severity="secondary" outlined size="small" class="!w-9 !h-9 !p-0 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white" v-tooltip.bottom="'Bersihkan Layar'" @click="clearView" />
                    <Button label="Refresh" icon="pi pi-sync" severity="secondary" outlined size="small" class="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white !font-bold !text-xs" @click="fetchLogs" :loading="loading" />
                    <Button label="Download" icon="pi pi-download" severity="primary" size="small" class="!font-bold !text-xs" @click="downloadLogs" :disabled="loading || !logs" />
                </div>
            </div>

            <div class="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative border-y border-black/50">
                
                <div class="h-8 bg-[#2d2d2d] border-b border-black/50 flex items-center px-4 justify-between select-none shrink-0">
                    <div class="flex gap-2">
                        <div class="w-3 h-3 rounded-full bg-red-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                        <div class="w-3 h-3 rounded-full bg-yellow-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                        <div class="w-3 h-3 rounded-full bg-green-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"></div>
                    </div>
                    <div class="text-[10px] text-surface-400 font-mono tracking-widest uppercase opacity-70">api.log - NestJS Server</div>
                    <div class="w-12"></div> </div>

                <div 
                    ref="logContainer"
                    class="flex-1 p-5 overflow-y-auto font-mono text-[11px] sm:text-xs leading-relaxed text-surface-300 whitespace-pre-wrap scrollbar-thin break-all"
                >
                    <div v-if="loading" class="flex flex-col items-center justify-center h-full opacity-50">
                        <i class="pi pi-spin pi-spinner text-3xl mb-3 text-primary-500"></i>
                        <span class="tracking-widest uppercase text-[10px]">Menghubungkan...</span>
                    </div>
                    
                    <div v-else-if="!logs" class="flex flex-col items-center justify-center h-full opacity-30">
                        <span class="tracking-widest uppercase text-[10px]">- Layar Kosong -</span>
                    </div>

                    <div v-else v-html="logs.replace(/ERROR/g, '<span class=\'text-red-400 font-bold bg-red-400/10 px-1 rounded\'>ERROR</span>')
                                           .replace(/INFO/g, '<span class=\'text-blue-400 font-bold\'>INFO</span>')
                                           .replace(/WARN/g, '<span class=\'text-yellow-400 font-bold bg-yellow-400/10 px-1 rounded\'>WARN</span>')
                                           .replace(/NestFactory/g, '<span class=\'text-emerald-400\'>NestFactory</span>')
                                           .replace(/RoutesResolver/g, '<span class=\'text-purple-400\'>RoutesResolver</span>')">
                    </div>
                </div>
            </div>

            <div class="p-4 bg-surface-50 flex justify-between items-center border-t border-surface-100 shrink-0">
                <Button label="Kembali" icon="pi pi-arrow-left" text severity="secondary" size="small" @click="router.back()" class="!font-bold !text-xs" />
                <div class="text-[10px] text-surface-400 font-mono uppercase tracking-widest font-bold">
                    <span v-if="!loading" class="flex items-center gap-2"><div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Connected</span>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
/* Styling khusus untuk scrollbar di dalam terminal */
.scrollbar-thin::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}
.scrollbar-thin::-webkit-scrollbar-track {
    background: #1e1e1e;
    border-left: 1px solid #333;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 0px;
}
.scrollbar-thin:hover::-webkit-scrollbar-thumb {
    background-color: #6b7280;
}
</style>