<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';

const emit = defineEmits(['import-success']);
const toast = useToast();

const fileInputRef = ref(null);
const selectedFileName = ref('');

const isImporting = ref(false);
const isExporting = ref(false);
const exportFormat = ref('xlsx'); 

const exportFormats = ref([
    { label: '.XLSX (Modern)', value: 'xlsx' },
    { label: '.XLS (Lama)', value: 'xls' },
    { label: '.CSV (Teks)', value: 'csv' }
]);

// --- LOGIKA EXPORT & TEMPLATE ---
const handleExportData = async (formatOverride = null) => {
    isExporting.value = true;
    const format = formatOverride || exportFormat.value;
    try {
        await useIeService().exportProduct(format);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: `Data / Template siap diunduh (Format ${format.toUpperCase()})`, life: 4000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat menyiapkan file.', life: 4000 });
    } finally {
        isExporting.value = false;
    }
};

const downloadTemplate = () => {
    handleExportData('xlsx');
};

// --- LOGIKA IMPORT ---
const triggerFileSelect = () => {
    if (fileInputRef.value) fileInputRef.value.click();
};

const handleFileSelect = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        selectedFileName.value = files[0].name;
    }
};

const clearFile = (event) => {
    if (event) event.stopPropagation(); // Mencegah memicu triggerFileSelect
    selectedFileName.value = '';
    if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleImportData = async () => {
    const files = fileInputRef.value?.files;
    if (!files || files.length === 0) {
        toast.add({ severity: 'warn', summary: 'File Belum Dipilih', detail: 'Silakan pilih file Excel atau CSV terlebih dahulu', life: 3000 });
        return;
    }

    const file = files[0];
    isImporting.value = true;

    try {
        const response = await useIeService().importProduct(file);
        
        const success = response?.success || 0;
        const failed = response?.failed || 0;

        clearFile(); // Reset file input

        toast.add({ 
            severity: failed > 0 ? 'warn' : 'success', 
            summary: 'Import Selesai', 
            detail: `Sukses: ${success} baris. Gagal: ${failed} baris.`,
            life: 6000
        });
        
        emit('import-success');
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Terjadi kesalahan saat memproses impor file', life: 4000 });
    } finally {
        isImporting.value = false;
    }
};
</script>

<template>
    <div class="p-2 sm:p-6">
        <div class="bg-surface-0 shadow-sm border border-surface-200 rounded-2xl overflow-hidden animate-fade-in">
            
            <div class="px-8 py-6 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold text-surface-800">Pusat Impor & Ekspor Produk</h1>
                    <p class="text-sm text-surface-500 mt-1">Kelola data master produk secara massal dengan mudah menggunakan Spreadsheet.</p>
                </div>
                <div class="hidden md:block">
                    <i class="pi pi-database text-4xl text-surface-300"></i>
                </div>
            </div>
            
            <div class="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                
                <div class="flex flex-col relative h-full">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                            <i class="pi pi-cloud-upload text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-surface-800">Impor Data Produk</h2>
                            <p class="text-xs text-surface-500">Unggah file Excel (XLSX/XLS) atau CSV.</p>
                        </div>
                    </div>

                    <div class="flex-grow flex flex-col">
                        <div 
                            class="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors duration-200 min-h-[160px] group mb-6"
                            :class="selectedFileName ? 'border-green-400 bg-green-50' : 'border-surface-300 hover:border-green-400 hover:bg-surface-50 cursor-pointer'"
                            @click="!selectedFileName && triggerFileSelect()"
                        >
                            <input type="file" ref="fileInputRef" class="hidden" accept=".xlsx, .xls, .csv" @change="handleFileSelect" />
                            
                            <div v-if="selectedFileName" class="flex flex-col items-center w-full animate-fade-in">
                                <i class="pi pi-file-excel text-green-600 text-4xl mb-3"></i>
                                <div class="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-green-200 shadow-sm max-w-full">
                                    <span class="text-sm font-semibold text-surface-700 truncate max-w-[200px]" :title="selectedFileName">{{ selectedFileName }}</span>
                                    <button @click.stop="clearFile" class="text-surface-400 hover:text-red-500 transition-colors ml-2 p-1 rounded-full hover:bg-red-50">
                                        <i class="pi pi-times text-xs"></i>
                                    </button>
                                </div>
                            </div>

                            <div v-else class="flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity">
                                <i class="pi pi-upload text-surface-400 text-3xl mb-3"></i>
                                <p class="text-sm font-medium text-surface-600">Klik untuk memilih file</p>
                                <p class="text-xs text-surface-400 mt-1">atau seret file ke area ini</p>
                            </div>
                        </div>

                        <div class="mt-auto flex flex-col items-center w-full gap-3">
                            <Button 
                                label="Mulai Impor Data" 
                                icon="pi pi-check-circle" 
                                severity="success" 
                                class="w-full shadow-sm"
                                size="large"
                                :loading="isImporting" 
                                :disabled="isExporting || !selectedFileName" 
                                @click="handleImportData" 
                            />
                            
                            <button 
                                @click="downloadTemplate" 
                                class="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors flex items-center gap-1.5 mt-2 outline-none"
                            >
                                <i class="pi pi-download text-[10px]"></i> Unduh Template Excel Kosong
                            </button>
                        </div>
                    </div>
                </div>

                <div class="hidden lg:block absolute left-1/2 top-8 bottom-8 w-px bg-surface-200 -ml-px"></div>

                <div class="flex flex-col relative h-full lg:pl-4">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                            <i class="pi pi-cloud-download text-xl"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-surface-800">Ekspor Data Produk</h2>
                            <p class="text-xs text-surface-500">Unduh data ke perangkat Anda.</p>
                        </div>
                    </div>

                    <div class="flex-grow flex flex-col">
                        <div class="bg-surface-50 border border-surface-200 rounded-xl p-6 mb-6">
                            <p class="text-sm font-medium text-surface-700 mb-4">Pilih Format Unduhan:</p>
                            
                            <SelectButton 
                                v-model="exportFormat" 
                                :options="exportFormats" 
                                optionLabel="label" 
                                optionValue="value" 
                                :disabled="isExporting"
                                class="w-full custom-select-btn"
                            />
                            
                            <div class="mt-4 text-xs text-surface-500 flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <i class="pi pi-info-circle text-blue-500 mt-0.5"></i>
                                <span>
                                    Format <b>.XLSX</b> direkomendasikan karena menyertakan tab referensi (Kategori, Rak, dll) dan fitur *Dropdown*.
                                </span>
                            </div>
                        </div>

                        <div class="mt-auto flex flex-col items-center w-full gap-3">
                            <Button 
                                label="Ekspor & Unduh Data" 
                                icon="pi pi-download" 
                                severity="info" 
                                class="w-full shadow-sm"
                                size="large"
                                :loading="isExporting" 
                                :disabled="isImporting" 
                                @click="handleExportData(null)" 
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
/* Membuat opsi SelectButton rata lebar (Full width) */
:deep(.custom-select-btn .p-selectbutton) {
    display: flex;
    width: 100%;
}
:deep(.custom-select-btn .p-button) {
    flex: 1 1 auto;
    justify-content: center;
    font-size: 0.85rem;
    padding: 0.6rem;
}

.animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
    from { 
        opacity: 0; 
        transform: translateY(8px); 
    }
    to { 
        opacity: 1; 
        transform: translateY(0); 
    }
}
</style>