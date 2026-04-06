<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useRuntimeConfig } from '#app';

const mediaService = useMediaService();
const toast = useToast();
const confirm = useConfirm();
const config = useRuntimeConfig();

const mediaList = ref([]);
const loading = ref(false);
const viewMode = ref('grid'); 
const currentPath = ref(''); 

// Modal Folder Baru
const showFolderModal = ref(false);
const newFolderName = ref('');

const breadcrumbs = computed(() => {
    if (!currentPath.value) return [];
    return currentPath.value.split('/').filter(p => p);
});

const fetchMedia = async () => {
    loading.value = true;
    try {
        const res = await mediaService.getAllMedia(currentPath.value);
        mediaList.value = res?.data || res || [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal membaca isi folder' });
    } finally {
        loading.value = false;
    }
};

// --- HELPER: ADAPTASI STRUKTUR DATA BACKEND ---
// Menangani jika backend pakai format lama (fileName) atau baru (name)
const getItemName = (item) => item.name || item.fileName || 'Unknown File';
const getItemPath = (item) => item.path || item.filePath || item.url || item.fileName || '';
const getItemSize = (item) => item.size || item.fileSize || 0;
const isFolder = (item) => item.isDir === true || item.fileType === 'folder';

// --- HELPER: RESOLVE URL GAMBAR ---
const resolveFileUrl = (item) => {
    let pathStr = getItemPath(item);
    if (!pathStr) return '';

    // Ambil base URL API (menghilangkan /api di belakangnya)
    const baseUrl = config.public.apiBase.replace('/api', '');
    let cleanPath = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;

    // Pastikan ada prefix /uploads/
    if (!cleanPath.includes('/uploads/')) {
        cleanPath = `/uploads${cleanPath}`;
    }

    return `${baseUrl}${cleanPath}`;
};

// --- NAVIGASI FOLDER ---
const openFolder = (folderName) => {
    currentPath.value = currentPath.value ? `${currentPath.value}/${folderName}` : folderName;
    fetchMedia();
};

const goToRoot = () => {
    currentPath.value = '';
    fetchMedia();
};

const goToBreadcrumb = (index) => {
    const parts = currentPath.value.split('/').filter(p => p);
    currentPath.value = parts.slice(0, index + 1).join('/');
    fetchMedia();
};

// --- AKSI MEDIA ---
const createNewFolder = async () => {
    if (!newFolderName.value.trim()) return;
    try {
        await mediaService.createFolder(currentPath.value, newFolderName.value.trim());
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Folder dibuat' });
        showFolderModal.value = false;
        newFolderName.value = '';
        fetchMedia();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.response?._data?.message || 'Gagal membuat folder' });
    }
};

const onUpload = async (event) => {
    const file = event.files[0];
    try {
        // Cek apakah pakai service dengan path (format baru) atau tanpa path (format lama)
        if (mediaService.uploadMedia.length > 1) {
            await mediaService.uploadMedia(file, currentPath.value);
        } else {
            await mediaService.uploadMedia(file);
        }
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'File terupload' });
        fetchMedia(); 
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal upload file' });
    }
};

const confirmDelete = (item) => {
    const itemPath = getItemPath(item);
    const itemName = getItemName(item);
    
    confirm.require({
        message: isFolder(item) ? `Hapus folder "${itemName}" beserta isinya?` : `Hapus file "${itemName}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: 'Ya, Hapus',
        rejectLabel: 'Batal',
        accept: async () => {
            try {
                await mediaService.deleteMedia(itemPath);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Item berhasil dihapus' });
                fetchMedia();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus item' });
            }
        }
    });
};

const copyUrl = (item) => {
    const url = resolveFileUrl(item);
    navigator.clipboard.writeText(url);
    toast.add({ severity: 'info', summary: 'Disalin', detail: 'URL File disalin ke clipboard', life: 2000 });
};

// --- HELPER VISUAL ---
const isImage = (type) => {
    if (!type || type === 'folder') return false;
    const ext = type.toLowerCase().replace('.', '');
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
};

const getFileIcon = (type) => {
    if (!type || type === 'folder') return 'pi-folder';
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

        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
                <h1 class="text-2xl font-black text-surface-900 uppercase tracking-tight">Media Library</h1>
            </div>
            
            <div class="flex items-center gap-3 w-full md:w-auto">
                <div class="bg-white rounded-lg border border-surface-200 p-1 flex shadow-sm">
                    <button @click="viewMode = 'grid'" class="w-8 h-8 flex items-center justify-center rounded transition-colors" :class="viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-700'"><i class="pi pi-th-large text-sm"></i></button>
                    <button @click="viewMode = 'list'" class="w-8 h-8 flex items-center justify-center rounded transition-colors" :class="viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-700'"><i class="pi pi-list text-sm"></i></button>
                </div>
                <Button icon="pi pi-folder-plus" label="Folder Baru" outlined @click="showFolderModal = true" class="bg-white" />
                <FileUpload mode="basic" auto chooseLabel="Upload File" @uploader="onUpload" customUpload class="p-button-primary" />
            </div>
        </div>

        <div class="flex items-center gap-2 mb-6 text-surface-600 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-surface-200 overflow-x-auto whitespace-nowrap">
            <Button icon="pi pi-home" text rounded size="small" class="!w-8 !h-8 !p-0" @click="goToRoot" />
            <i class="pi pi-chevron-right text-[10px] text-surface-400" v-if="breadcrumbs.length > 0"></i>
            <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
                <span class="cursor-pointer hover:text-primary-600 font-bold text-sm transition-colors" @click="goToBreadcrumb(idx)">{{ crumb }}</span>
                <i class="pi pi-chevron-right text-[10px] text-surface-400" v-if="idx < breadcrumbs.length - 1"></i>
            </template>
        </div>

        <div v-if="loading" class="flex flex-col justify-center items-center py-20 gap-3">
            <ProgressSpinner strokeWidth="4" class="w-10 h-10" />
            <span class="text-surface-500 text-sm font-medium">Memuat data...</span>
        </div>

        <div v-else-if="mediaList.length === 0" class="text-center py-20 border-2 border-dashed border-surface-300 rounded-2xl bg-surface-0/50">
            <i class="pi pi-folder-open text-6xl text-surface-300 mb-4"></i>
            <p class="text-surface-600 font-bold">Folder ini kosong.</p>
            <p class="text-surface-400 text-sm mt-1">Buat folder baru atau upload file.</p>
        </div>

        <template v-else>
            <div v-if="viewMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
                <div v-for="(item, idx) in mediaList" :key="idx" class="group bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer hover:border-primary-300 relative">
                    
                    <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button icon="pi pi-trash" severity="danger" rounded text class="!bg-white/80 backdrop-blur-sm shadow-sm" @click.stop="confirmDelete(item)" />
                    </div>

                    <div v-if="isFolder(item)" @click="openFolder(getItemName(item))" class="flex flex-col items-center justify-center aspect-square bg-surface-50 hover:bg-yellow-50/50 transition-colors">
                        <i class="pi pi-folder text-7xl text-yellow-400 drop-shadow-sm group-hover:scale-105 transition-transform mb-2"></i>
                        <span class="font-bold text-surface-800 text-sm px-3 text-center truncate w-full" :title="getItemName(item)">{{ getItemName(item) }}</span>
                    </div>

                    <template v-else>
                        <div class="relative aspect-square bg-surface-100 flex items-center justify-center overflow-hidden">
                            <img v-if="isImage(item.fileType)" 
                                 :src="resolveFileUrl(item)" 
                                 class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                 loading="lazy" 
                                 onerror="this.src='https://placehold.co/400?text=Gambar+Rusak&font=roboto'" />
                            
                            <div v-else class="flex flex-col items-center">
                                <i :class="['pi text-5xl mb-2', getFileIcon(item.fileType)]"></i>
                                <span class="text-[10px] font-black uppercase tracking-widest text-surface-500">{{ item.fileType }}</span>
                            </div>

                            <div class="absolute inset-0 bg-surface-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                <Button icon="pi pi-copy" severity="info" rounded outlined class="!bg-surface-900/50 !text-white !border-white hover:!bg-info-500 hover:!border-info-500 !w-8 !h-8" v-tooltip.top="'Copy URL'" @click.stop="copyUrl(item)" />
                                <Button icon="pi pi-external-link" rounded outlined class="!bg-surface-900/50 !text-white !border-white hover:!bg-primary-500 hover:!border-primary-500 !w-8 !h-8" v-tooltip.top="'Buka'" @click.stop="window.open(resolveFileUrl(item), '_blank')" />
                            </div>
                        </div>

                        <div class="p-3 border-t border-surface-100 bg-surface-0 flex flex-col justify-between flex-1 pointer-events-none">
                            <div class="text-xs font-semibold text-surface-800 truncate mb-1" :title="getItemName(item)">{{ getItemName(item) }}</div>
                            <div class="flex justify-between items-center text-[10px] text-surface-500 font-medium">
                                <span class="uppercase">{{ item.fileType || 'FILE' }}</span>
                                <span>{{ formatSize(getItemSize(item)) }}</span>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <div v-else class="flex flex-col gap-2 animate-fade-in">
                <div v-for="(item, idx) in mediaList" :key="idx" class="bg-white border border-surface-200 rounded-xl p-3 flex items-center gap-4 hover:shadow-sm hover:border-primary-300 transition-all group">
                    
                    <template v-if="isFolder(item)">
                        <div class="w-12 h-12 flex items-center justify-center shrink-0">
                            <i class="pi pi-folder text-4xl text-yellow-400"></i>
                        </div>
                        <div class="flex-1 min-w-0 cursor-pointer" @click="openFolder(getItemName(item))">
                            <div class="text-base font-bold text-surface-800 truncate group-hover:text-primary-600 transition-colors">{{ getItemName(item) }}</div>
                            <div class="text-xs text-surface-500">Folder</div>
                        </div>
                        <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.top="'Hapus Folder'" @click="confirmDelete(item)" />
                    </template>

                    <template v-else>
                        <div class="w-12 h-12 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden border border-surface-100 cursor-pointer" @click="window.open(resolveFileUrl(item), '_blank')">
                            <img v-if="isImage(item.fileType)" :src="resolveFileUrl(item)" class="w-full h-full object-cover" loading="lazy" onerror="this.src='https://placehold.co/100?text=Err'" />
                            <i v-else :class="['pi text-2xl', getFileIcon(item.fileType)]"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold text-surface-800 truncate mb-1" :title="getItemName(item)">{{ getItemName(item) }}</div>
                            <div class="flex items-center gap-3 text-xs text-surface-500 font-medium">
                                <span class="uppercase bg-surface-100 px-1.5 py-0.5 rounded">{{ item.fileType || 'FILE' }}</span>
                                <span><i class="pi pi-database text-[10px] mr-1"></i>{{ formatSize(getItemSize(item)) }}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <Button icon="pi pi-copy" text rounded severity="info" v-tooltip.top="'Copy URL'" @click="copyUrl(item)" />
                            <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.top="'Hapus'" @click="confirmDelete(item)" />
                        </div>
                    </template>

                </div>
            </div>
        </template>

        <Dialog v-model:visible="showFolderModal" header="Buat Folder Baru" modal :style="{ width: '350px' }">
            <div class="flex flex-col gap-4 pt-2">
                <div>
                    <label class="text-xs font-bold mb-1 block">Nama Folder</label>
                    <InputText v-model="newFolderName" placeholder="Contoh: Banner Promo" autofocus class="w-full" @keyup.enter="createNewFolder" />
                </div>
                <div class="flex justify-end gap-2 mt-2">
                    <Button label="Batal" text severity="secondary" @click="showFolderModal = false" />
                    <Button label="Buat Folder" @click="createNewFolder" :disabled="!newFolderName" />
                </div>
            </div>
        </Dialog>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>