<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

// Props & Emits
const props = defineProps({
    visible: Boolean,
    shelfData: { type: Object, default: null } // Jika null = Create, jika ada object = Edit
});

const emit = defineEmits(['update:visible', 'saved']);

// Services (Asumsi Anda akan membuat ShelfService nanti)
// const shelfService = useShelfService(); 
const toast = useToast();

// --- STATE ---
const submitted = ref(false);
const loading = ref(false);

// Form State
const form = reactive({
    name: '',
    description: '',
    capacity: 0
});

const isEditMode = computed(() => !!props.shelfData);

// --- HELPERS ---
const resetForm = () => {
    form.name = '';
    form.description = '';
    form.capacity = 0;
    submitted.value = false;
};

const populateForm = () => {
    if (props.shelfData) {
        form.name = props.shelfData.name;
        form.description = props.shelfData.description;
        form.capacity = props.shelfData.capacity || 0;
    }
};

// Watcher saat modal dibuka/tutup
watch(() => props.visible, (val) => {
    if (val) {
        if (props.shelfData) {
            populateForm();
        } else {
            resetForm();
        }
    }
});

// --- ACTIONS ---
const handleSave = async () => {
    submitted.value = true;

    // Validasi Sederhana
    if (!form.name) {
        return;
    }

    loading.value = true;

    try {
        // Simulasi API Call (Ganti dengan shelfService.create / update nanti)
        await new Promise(r => setTimeout(r, 800));

        // Construct Payload
        const payload = { ...form };

        if (isEditMode.value) {
            // await shelfService.update(props.shelfData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data rak diperbarui', life: 3000 });
        } else {
            // await shelfService.create(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Rak baru dibuat', life: 3000 });
        }

        // Tutup Modal & Refresh Parent
        emit('saved');
        closeDialog();

    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan sistem', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const closeDialog = () => {
    emit('update:visible', false);
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Lokasi Rak' : 'Buat Rak Baru'" 
        :modal="true" 
        :style="{ width: '500px' }" 
        class="p-fluid"
    >
        <div class="flex flex-col gap-5 pt-2">
            
            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                    Kode / Nama Rak <span class="text-red-500">*</span>
                </label>
                <InputText 
                    v-model="form.name" 
                    placeholder="Contoh: Rak A-01" 
                    class="w-full focus:ring-2 focus:ring-primary-500" 
                    :class="{'p-invalid': submitted && !form.name}" 
                    autofocus 
                />
                <small v-if="submitted && !form.name" class="text-red-500 text-xs">Wajib diisi.</small>
            </div>

            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                    Keterangan Tambahan
                </label>
                <Textarea 
                    v-model="form.description" 
                    rows="3" 
                    placeholder="Catatan khusus untuk rak ini..." 
                    class="w-full resize-none" 
                />
            </div>

            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                    Kapasitas (Opsional)
                </label>
                <InputNumber 
                    v-model="form.capacity" 
                    placeholder="0" 
                    class="w-full" 
                    inputClass="text-center" 
                    suffix=" Item" 
                />
            </div>

        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-4 border-t border-surface-100 dark:border-surface-700 mt-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="closeDialog" />
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Rak'" icon="pi pi-check" :loading="loading" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>