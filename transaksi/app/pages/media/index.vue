<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useRuntimeConfig } from '#app'; // Untuk mengambil konfigurasi URL API

const mediaService = useMediaService();
const toast = useToast();
const confirm = useConfirm();
const config = useRuntimeConfig();

const mediaList = ref([]);
const loading = ref(false);
const viewMode = ref('grid'); // 'grid' atau 'list'

const fetchMedia = async () => {
    loading.value = true;
    try {
        const res = await mediaService.getAllMedia();
        mediaList.value = res?.data || res || [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal membaca folder uploads' });
    } finally {
        loading.value = false;
    }
};

const onUpload = async (event) => {
    const file = event.files[0];
    try {
        await mediaService.uploadMedia(file);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'File tersimpan di folder' });
        fetchMedia(); // Refresh list
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal upload file' });
    }
};

const confirmDelete = (fileName) => {
    confirm.require({
        message: `Apakah Anda yakin ingin menghapus file "${fileName}"? Tindakan ini tidak bisa dibatalkan.`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        accept: async () => {
            try {
                await mediaService.deleteMedia(fileName);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'File berhasil dihapus' });
                fetchMedia();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus file' });
            }
        }
    });
};

// --- HELPER: RESOLVE URL ---
// Memastikan URL valid dan selalu mengarah ke folder /uploads/ di backend
const resolveFileUrl = (file) => {
    let path = file.filePath || file.url || file.fileName;
    if (!path) return '';

    const baseUrl = config.public.apiBase.replace('/api', '');
    let cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Jika path belum memiliki /uploads/, tambahkan secara paksa
    if (!cleanPath.includes('/uploads/')) {
        cleanPath = `/uploads${cleanPath}`;
    }

    return `${baseUrl}${cleanPath}`;
};

const copyUrl = (file) => {
    const url = resolveFileUrl(file);
    navigator.clipboard.writeText(url);
    toast.add({ severity: 'info', summary: 'Disalin', detail: 'URL File disalin ke clipboard', life: 2000 });
};

// --- HELPER: FILE TYPE & ICON ---
const isImage = (type) => {
    if (!type) return false;
    const ext = type.toLowerCase().replace('.', '');
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
};

const getFileIcon = (type) => {
    if (!type) return 'pi-file';
    const ext = type.toLowerCase().replace('.', '');
    
    if (['pdf'].includes(ext)) return 'pi-file-pdf text-red-500';
    if (['doc', 'docx'].includes(ext)) return 'pi-file-word text-blue-500';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'pi-file-excel text-emerald-500';
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return 'pi-file-archive text-orange-500';
    if (['mp4', 'mkv', 'avi'].includes(ext)) return 'pi-video text-purple-500';
    
    return 'pi-file text-surface-400';
};

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

onMounted(() => fetchMedia());
definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="p-4 md:p-6 bg-surface-50 min-h-screen">
        <Toast />
        <ConfirmDialog />

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-black text-surface-900 uppercase tracking-tight">Media Library</h1>
                <p class="text-sm text-surface-500 mt-1">Manajemen aset file gambar dan dokumen.</p>
            </div>
            
            <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="bg-white rounded-lg border border-surface-200 p-1 flex shadow-sm">
                    <button @click="viewMode = 'grid'" class="w-8 h-8 flex items-center justify-center rounded transition-colors" :class="viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-700'">
                        <i class="pi pi-th-large text-sm"></i>
                    </button>
                    <button @click="viewMode = 'list'" class="w-8 h-8 flex items-center justify-center rounded transition-colors" :class="viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-700'">
                        <i class="pi pi-list text-sm"></i>
                    </button>
                </div>
                <FileUpload mode="basic" auto chooseLabel="Upload File" @uploader="onUpload" customUpload class="p-button-primary" />
            </div>
        </div>

        <div v-if="loading" class="flex flex-col justify-center items-center py-20 gap-3">
            <ProgressSpinner strokeWidth="4" class="w-10 h-10" />
            <span class="text-surface-500 text-sm font-medium">Memuat isi folder...</span>
        </div>

        <div v-else-if="mediaList.length === 0" class="text-center py-20 border-2 border-dashed border-surface-300 rounded-2xl bg-surface-0/50">
            <i class="pi pi-folder-open text-6xl text-surface-300 mb-4"></i>
            <p class="text-surface-600 font-bold">Belum ada file di folder uploads.</p>
            <p class="text-surface-400 text-sm mt-1">Silakan upload gambar atau file pertama Anda.</p>
        </div>

        <template v-else>
            <div v-if="viewMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
                <div v-for="file in mediaList" :key="file.fileName" class="group bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                    
                    <div class="relative aspect-square bg-surface-100 flex items-center justify-center overflow-hidden">
                        
                        <img v-if="isImage(file.fileType)" 
                             :src="resolveFileUrl(file)" 
                             class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                             loading="lazy" 
                             onerror="this.src='https://placehold.co/400?text=Gambar+Rusak&font=roboto'" />
                        
                        <div v-else class="flex flex-col items-center">
                            <i :class="['pi text-5xl mb-2', getFileIcon(file.fileType)]"></i>
                            <span class="text-[10px] font-black uppercase tracking-widest text-surface-500">{{ file.fileType }}</span>
                        </div>

                        <div class="absolute inset-0 bg-surface-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                            <Button icon="pi pi-copy" severity="info" rounded outlined class="!bg-surface-900/50 !text-white !border-white hover:!bg-info-500 hover:!border-info-500 !w-8 !h-8" v-tooltip.top="'Copy URL'" @click="copyUrl(file)" />
                            <Button icon="pi pi-external-link" rounded outlined class="!bg-surface-900/50 !text-white !border-white hover:!bg-primary-500 hover:!border-primary-500 !w-8 !h-8" v-tooltip.top="'Buka'" @click="window.open(resolveFileUrl(file), '_blank')" />
                            <Button icon="pi pi-trash" severity="danger" rounded outlined class="!bg-surface-900/50 !text-white !border-white hover:!bg-red-500 hover:!border-red-500 !w-8 !h-8" v-tooltip.top="'Hapus'" @click="confirmDelete(file.fileName)" />
                        </div>
                    </div>

                    <div class="p-3 border-t border-surface-100 bg-surface-0 flex flex-col justify-between flex-1">
                        <div class="text-xs font-semibold text-surface-800 truncate mb-1" :title="file.fileName">{{ file.fileName }}</div>
                        <div class="flex justify-between items-center text-[10px] text-surface-500 font-medium">
                            <span class="uppercase">{{ file.fileType || 'FILE' }}</span>
                            <span>{{ formatSize(file.fileSize) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="flex flex-col gap-3 animate-fade-in">
                <div v-for="file in mediaList" :key="file.fileName" class="bg-white border border-surface-200 rounded-xl p-3 flex items-center gap-4 hover:shadow-sm hover:border-primary-300 transition-all group">
                    
                    <div class="w-14 h-14 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden border border-surface-100">
                        <img v-if="isImage(file.fileType)" 
                             :src="resolveFileUrl(file)" 
                             class="w-full h-full object-cover" 
                             loading="lazy" 
                             onerror="this.src='https://placehold.co/100?text=Error'" />
                        <i v-else :class="['pi text-2xl', getFileIcon(file.fileType)]"></i>
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-surface-800 truncate mb-1 group-hover:text-primary-600 transition-colors cursor-pointer" :title="file.fileName" @click="window.open(resolveFileUrl(file), '_blank')">
                            {{ file.fileName }}
                        </div>
                        <div class="flex items-center gap-3 text-xs text-surface-500 font-medium">
                            <span class="uppercase bg-surface-100 px-1.5 py-0.5 rounded">{{ file.fileType || 'FILE' }}</span>
                            <span><i class="pi pi-database text-[10px] mr-1"></i>{{ formatSize(file.fileSize) }}</span>
                            <span v-if="file.createdAt"><i class="pi pi-calendar text-[10px] mr-1"></i>{{ new Date(file.createdAt).toLocaleDateString('id-ID') }}</span>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                        <Button icon="pi pi-copy" text rounded severity="info" v-tooltip.top="'Copy URL'" @click="copyUrl(file)" />
                        <Button icon="pi pi-external-link" text rounded severity="secondary" v-tooltip.top="'Buka di Tab Baru'" @click="window.open(resolveFileUrl(file), '_blank')" />
                        <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.top="'Hapus'" @click="confirmDelete(file.fileName)" />
                    </div>

                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>