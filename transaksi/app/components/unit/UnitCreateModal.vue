<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    unitData: { type: Object, default: null }
});

const emit = defineEmits(['update:visible', 'saved']);

const unitService = useUnitService();
const toast = useToast();

const loading = ref(false);
const submitted = ref(false);
const isEditMode = computed(() => !!props.unitData?.uuid);

const form = reactive({
    name: ''
});

// Reset atau isi form saat modal terbuka/tertutup
watch(() => props.visible, (val) => {
    if (val) {
        submitted.value = false;
        if (props.unitData) {
            form.name = props.unitData.name;
        } else {
            form.name = '';
        }
    }
});

const saveUnit = async () => {
    submitted.value = true;
    
    // Validasi
    if (!form.name.trim()) return;

    loading.value = true;
    try {
        if (isEditMode.value) {
            await unitService.updateUnit(props.unitData.uuid, { name: form.name });
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Satuan diperbarui' });
        } else {
            await unitService.createUnit({ name: form.name });
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Satuan baru ditambahkan' });
        }
        emit('saved'); // Memicu refresh di list
    } catch (e) {
        console.error(e);
        toast.add({ 
            severity: 'error', 
            summary: 'Gagal', 
            detail: e.response?._data?.message || 'Terjadi kesalahan sistem' 
        });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Satuan' : 'Tambah Satuan Baru'" 
        :modal="true" 
        :style="{ width: '400px' }"
        class="p-fluid bg-surface-0 rounded-xl overflow-hidden"
    >
        <div class="py-4">
            <div class="field">
                <label for="name" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Nama Satuan <span class="text-red-500">*</span>
                </label>
                <InputText 
                    id="name" 
                    v-model="form.name" 
                    placeholder="Contoh: Pcs, Dus, Pack" 
                    :class="{'p-invalid': submitted && !form.name}" 
                    autofocus 
                />
                <small class="text-red-500 mt-1 block" v-if="submitted && !form.name">
                    Nama satuan wajib diisi.
                </small>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 mt-2">
                <Button 
                    label="Batal" 
                    icon="pi pi-times" 
                    text 
                    severity="secondary" 
                    size="small"
                    @click="emit('update:visible', false)" 
                />
                <Button 
                    :label="isEditMode ? 'Simpan' : 'Tambah'" 
                    icon="pi pi-check" 
                    size="small"
                    :loading="loading" 
                    @click="saveUnit" 
                />
            </div>
        </template>
    </Dialog>
</template>