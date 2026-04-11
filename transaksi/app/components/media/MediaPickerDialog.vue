<template>
    <Dialog 
        v-model:visible="isVisible" 
        modal 
        header="Pilih Media" 
        :style="{ width: '60vw' }" 
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
        @show="fetchMedia"
    >
        <div class="flex flex-col gap-4">
            
            <div class="p-4 border border-surface-200 rounded-lg bg-surface-50 flex items-center justify-between">
                <div>
                    <h3 class="font-bold text-surface-700">Upload Media Baru</h3>
                    <p class="text-sm text-surface-500">Pilih gambar dari perangkat Anda untuk diunggah.</p>
                </div>
                <FileUpload 
                    mode="basic" 
                    name="file" 
                    accept="image/*" 
                    :maxFileSize="2000000" 
                    customUpload 
                    @uploader="onUploadMedia" 
                    auto 
                    chooseLabel="Upload File" 
                />
            </div>

            <Divider />

            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="font-bold text-surface-700">Galeri Media</h3>
                    <Button 
                        v-if="selectedMedia.length > 0" 
                        label="Hapus Terpilih" 
                        icon="pi pi-trash" 
                        severity="danger" 
                        text 
                        size="small" 
                        @click="deleteSelectedMedia" 
                    />
                </div>
                
                <div v-if="loading" class="flex justify-center p-5">
                    <i class="pi pi-spin pi-spinner text-3xl text-primary-500"></i>
                </div>
                
                <div v-else-if="mediaList.length === 0" class="text-center p-5 text-surface-500 bg-surface-50 rounded-lg border border-dashed border-surface-200">
                    Belum ada media. Silakan upload gambar pertama Anda.
                </div>

                <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                    <div 
                        v-for="(media, index) in mediaList" 
                        :key="index"
                        class="relative w-full aspect-square border-2 rounded-lg cursor-pointer overflow-hidden transition-all duration-200 shadow-sm"
                        :class="isSelected(media) ? 'border-primary-500 scale-95 shadow-inner' : 'border-surface-200 hover:border-primary-300'"
                        @click="toggleSelect(media)"
                    >
                        <img :src="getMediaUrl(media)" class="w-full h-full object-cover bg-surface-100" alt="Media Item" />
                        
                        <div v-if="isSelected(media)" class="absolute top-1 right-1 bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                            <i class="pi pi-check text-[10px] font-bold"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-between items-center w-full">
                <span class="text-sm font-semibold text-surface-600">{{ selectedMedia.length }} gambar dipilih</span>
                <div class="flex gap-2">
                    <Button label="Batal" icon="pi pi-times" outlined severity="secondary" @click="isVisible = false" />
                    <Button label="Gunakan Gambar" icon="pi pi-check" @click="confirmSelection" :disabled="selectedMedia.length === 0" />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
// (Nuxt otomatis meng-import composables/useMediaService, tapi kita panggil di sini)

const props = defineProps({
    modelValue: Boolean,
    multiple: { type: Boolean, default: true } 
});

const emit = defineEmits(['update:modelValue', 'select']);

const toast = useToast();

// Panggil service API Media
const mediaService = useMediaService();

const loading = ref(false);
const mediaList = ref([]);
const selectedMedia = ref([]);
const currentPath = ref(''); // Untuk dukungan path/folder di masa depan

const isVisible = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

// Helper untuk mengekstrak URL dari format respons yang tidak menentu
const getMediaUrl = (media) => {
    // Ambil string path-nya terlebih dahulu
    const pathString = media.path || media.file_path || media.url || media.name || media;
    // Konversi path menjadi Full URL menggunakan config API
    return mediaService.getFileUrl(pathString);
};

// --- FUNGSI 1: Ambil data media ---
const fetchMedia = async () => {
    loading.value = true;
    selectedMedia.value = []; // Reset pilihan setiap dibuka
    try {
        const response = await mediaService.getAllMedia(currentPath.value);
        
        // Handle struktur respons API (array langsung, atau dalam data.files)
        let dataArray = [];
        if (Array.isArray(response)) dataArray = response;
        else if (response.data && Array.isArray(response.data)) dataArray = response.data;
        else if (response.data?.files) dataArray = response.data.files;

        // Filter hanya untuk file (mengabaikan folder jika object memiliki properti isDirectory)
        mediaList.value = dataArray.filter(m => !m.isDirectory);

    } catch (error) {
        console.error("Fetch media error:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat galeri media', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- FUNGSI 2: Upload Media Baru ---
const onUploadMedia = async (event) => {
    try {
        const file = event.files[0];
        
        // Panggil fungsi upload dari service (Otomatis handle FormData)
        const response = await mediaService.uploadMedia(file, currentPath.value);

        // Cari tahu path yang dikembalikan API
        const uploadedPath = response.data?.path || response.path || response.file_path || response.data?.url || response.url;
        
        if (uploadedPath) {
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Gambar berhasil diupload', life: 2000 });
            
            const fullUrl = mediaService.getFileUrl(uploadedPath);

            if (!props.multiple) selectedMedia.value = [];
            selectedMedia.value.push(fullUrl);
            
            await fetchMedia(); 
        }
    } catch (error) {
        console.error("Upload error:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal mengupload gambar', life: 3000 });
    }
};

// --- FUNGSI 3: Logika Pemilihan ---
const isSelected = (media) => {
    const fullUrl = getMediaUrl(media);
    return selectedMedia.value.includes(fullUrl);
};

const toggleSelect = (media) => {
    const fullUrl = getMediaUrl(media);
    const index = selectedMedia.value.indexOf(fullUrl);
    
    if (index > -1) {
        selectedMedia.value.splice(index, 1); // Deselect
    } else {
        if (props.multiple) {
            selectedMedia.value.push(fullUrl); // Multi select
        } else {
            selectedMedia.value = [fullUrl]; // Single select
        }
    }
};

// --- FUNGSI 4: Konfirmasi Pilihan ---
const confirmSelection = () => {
    // Mengembalikan array yang isinya berupa Full URL gambar (siap disimpan di table Product)
    emit('select', selectedMedia.value);
    isVisible.value = false;
};

// --- FUNGSI 5: Hapus Gambar (Opsional/Tambahan) ---
const deleteSelectedMedia = async () => {
    if(!confirm('Yakin ingin menghapus gambar yang dipilih dari server?')) return;
    
    try {
        loading.value = true;
        for (const url of selectedMedia.value) {
            // Karena API delete butuh path, kita ambil nama filenya dari URL
            const fileName = url.substring(url.lastIndexOf('/') + 1);
            await mediaService.deleteMedia(currentPath.value ? `${currentPath.value}/${fileName}` : fileName);
        }
        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Media terhapus', life: 2000 });
        await fetchMedia();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat menghapus media', life: 3000 });
    }
}
</script>