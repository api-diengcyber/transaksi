<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    tableData: { type: Object, default: null } // { uuid, name, capacity }
});

const emit = defineEmits(['update:visible', 'saved']);

const tableService = useTableService();
const toast = useToast();

const submitted = ref(false);
const loading = ref(false);

const form = reactive({
    name: '',
    capacity: 2
});

const isEditMode = computed(() => !!props.tableData);

const resetForm = () => {
    form.name = '';
    form.capacity = 2;
    submitted.value = false;
};

const populateForm = () => {
    if (props.tableData) {
        form.name = props.tableData.name;
        form.capacity = props.tableData.capacity ? Number(props.tableData.capacity) : 2;
    }
};

watch(() => props.visible, (val) => {
    if (val) {
        if (props.tableData) populateForm();
        else resetForm();
    }
});

const handleSave = async () => {
    submitted.value = true;
    if (!form.name || form.capacity < 1) return;

    loading.value = true;
    try {
        const payload = { ...form };

        if (isEditMode.value) {
            await tableService.updateTable(props.tableData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data meja diperbarui', life: 3000 });
        } else {
            await tableService.createTable(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Meja baru dibuat', life: 3000 });
        }

        emit('saved');
        closeDialog();
    } catch (e) {
        const msg = e.response?._data?.message || 'Terjadi kesalahan server';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
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
        :header="isEditMode ? 'Edit Meja' : 'Buat Meja Baru'" 
        :modal="true" 
        :style="{ width: '400px' }" 
        class="p-fluid"
    >
        <div class="flex flex-col gap-5 pt-2">
            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                    Nama Meja <span class="text-red-500">*</span>
                </label>
                <InputText 
                    v-model="form.name" 
                    placeholder="Contoh: Meja A1" 
                    class="w-full focus:ring-2 focus:ring-primary-500" 
                    :class="{'p-invalid': submitted && !form.name}" 
                    autofocus 
                />
            </div>

            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                    Kapasitas (Orang) <span class="text-red-500">*</span>
                </label>
                <InputNumber 
                    v-model="form.capacity" 
                    placeholder="2" 
                    :min="1"
                    showButtons
                    class="w-full" 
                    inputClass="text-center" 
                    suffix=" Orang" 
                />
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-4 border-t border-surface-100 dark:border-surface-700 mt-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="closeDialog" />
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Meja'" icon="pi pi-check" :loading="loading" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>