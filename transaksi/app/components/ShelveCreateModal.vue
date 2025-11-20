<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    shelfData: { type: Object, default: null } // Object: { uuid, name, description, capacity }
});

const emit = defineEmits(['update:visible', 'saved']);

const shelveService = useShelveService(); // Panggil Service
const toast = useToast();

const submitted = ref(false);
const loading = ref(false);

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
        // Pastikan konversi ke number aman
        form.capacity = props.shelfData.capacity ? Number(props.shelfData.capacity) : 0;
    }
};

watch(() => props.visible, (val) => {
    if (val) {
        if (props.shelfData) populateForm();
        else resetForm();
    }
});

// --- ACTIONS ---
const handleSave = async () => {
    submitted.value = true;
    if (!form.name) return;

    loading.value = true;
    try {
        const payload = { ...form };

        if (isEditMode.value) {
            await shelveService.updateShelve(props.shelfData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data rak diperbarui', life: 3000 });
        } else {
            await shelveService.createShelve(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Rak baru dibuat', life: 3000 });
        }

        emit('saved'); // Trigger parent untuk refresh list
        closeDialog();
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.response?._data?.message || 'Terjadi kesalahan server', life: 3000 });
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