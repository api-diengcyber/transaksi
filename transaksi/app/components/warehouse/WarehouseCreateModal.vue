<script setup>
import { reactive, watch, computed } from 'vue';

const props = defineProps({
    isOpen: Boolean,
    data: Object,
    loading: Boolean
});

const emit = defineEmits(['close', 'submit']);

const isEdit = computed(() => !!props.data);

// Form hanya berisi name dan location
const form = reactive({
    name: '',
    location: ''
});

// Reset atau isi form saat modal dibuka
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        if (props.data) {
            form.name = props.data.name || '';
            form.location = props.data.location || '';
        } else {
            form.name = '';
            form.location = '';
        }
    }
});

const handleSubmit = () => {
    if (!form.name) return;
    emit('submit', { ...form });
};
</script>

<template>
    <Dialog 
        :visible="isOpen" 
        @update:visible="(val) => !val && emit('close')" 
        :header="isEdit ? 'Edit Gudang' : 'Tambah Gudang Baru'" 
        modal 
        class="w-full max-w-md p-fluid"
    >
        <div class="flex flex-col gap-4 mt-2">
            <div class="field mb-0">
                <label class="text-xs font-bold text-surface-600 mb-1 block">Nama Gudang/Lokasi <span class="text-red-500">*</span></label>
                <InputText v-model="form.name" placeholder="Cth: Gudang Utama Jakarta" autofocus />
            </div>

            <div class="field mb-0">
                <label class="text-xs font-bold text-surface-600 mb-1 block">Alamat / Detail Lokasi</label>
                <Textarea v-model="form.location" rows="3" placeholder="Cth: Jl. Sudirman No. 123..." class="resize-none" />
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 mt-4">
                <Button label="Batal" text severity="secondary" size="small" @click="emit('close')" />
                <Button :label="isEdit ? 'Simpan Perubahan' : 'Simpan Gudang'" icon="pi pi-check" size="small" :loading="loading" :disabled="!form.name" @click="handleSubmit" />
            </div>
        </template>
    </Dialog>
</template>