<script setup>
import { ref, reactive, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    editData: Object
});
const emit = defineEmits(['update:visible', 'saved']);

const brandService = useBrandService();
const toast = useToast();
const loading = ref(false);

const form = reactive({
    name: '',
    description: ''
});

watch(() => props.visible, (newVal) => {
    if (newVal && props.editData) {
        form.name = props.editData.name;
        form.description = props.editData.description;
    } else {
        form.name = '';
        form.description = '';
    }
});

const save = async () => {
    loading.value = true;
    try {
        if (props.editData) {
            await brandService.updateBrand(props.editData.uuid, form);
        } else {
            await brandService.createBrand(form);
        }
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data merek berhasil disimpan', life: 3000 });
        emit('saved');
        emit('update:visible', false);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat menyimpan data', life: 3000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog :visible="visible" @update:visible="val => emit('update:visible', val)" :header="editData ? 'Edit Merek' : 'Tambah Merek'" modal class="w-full max-w-md">
        <div class="flex flex-col gap-4 pt-2">
            <div class="flex flex-col gap-2">
                <label class="font-bold text-sm">Nama Merek</label>
                <InputText v-model="form.name" placeholder="Contoh: Aqua, Indofood, dll" class="w-full" />
            </div>
            <div class="flex flex-col gap-2">
                <label class="font-bold text-sm">Deskripsi</label>
                <Textarea v-model="form.description" rows="3" placeholder="Opsional" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="Batal" text severity="secondary" @click="emit('update:visible', false)" />
            <Button label="Simpan" icon="pi pi-check" :loading="loading" @click="save" />
        </template>
    </Dialog>
</template>