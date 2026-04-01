<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    shelfData: { type: Object, default: null }
});

const emit = defineEmits(['update:visible', 'saved']);

const shelveService = useShelveService();
// Memanggil useWarehouseService yang baru saja dibuat
const warehouseService = useWarehouseService(); 
const toast = useToast();

const loading = ref(false);
const submitted = ref(false);
const isEditMode = computed(() => !!props.shelfData?.uuid);

const warehouses = ref([]); // State untuk opsi dropdown gudang

const form = reactive({
    name: '',
    warehouseUuid: null
});

// Load data gudang untuk dropdown
const loadWarehouses = async () => {
    try {
        const res = await warehouseService.getAllWarehouses();
        warehouses.value = res.data || res || [];
    } catch (error) {
        console.error("Gagal memuat gudang", error);
    }
};

watch(() => props.visible, async (val) => {
    if (val) {
        submitted.value = false;
        await loadWarehouses(); // Load gudang saat modal terbuka

        if (props.shelfData) {
            form.name = props.shelfData.name;
            form.warehouseUuid = props.shelfData.warehouseUuid || props.shelfData.warehouse?.uuid || null;
        } else {
            form.name = '';
            form.warehouseUuid = null;
        }
    }
});

const saveShelve = async () => {
    submitted.value = true;
    
    // Validasi
    if (!form.name.trim()) return;

    loading.value = true;
    try {
        const payload = {
            name: form.name,
            warehouseUuid: form.warehouseUuid
        };

        if (isEditMode.value) {
            await shelveService.updateShelve(props.shelfData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Rak diperbarui' });
        } else {
            await shelveService.createShelve(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Rak baru ditambahkan' });
        }
        emit('saved');
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
        :header="isEditMode ? 'Edit Rak' : 'Tambah Rak Baru'" 
        :modal="true" 
        :style="{ width: '450px' }"
        class="p-fluid bg-surface-0 rounded-xl overflow-hidden"
    >
        <div class="py-4 flex flex-col gap-4">
            <div class="field">
                <label for="name" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Nama Rak <span class="text-red-500">*</span>
                </label>
                <InputText 
                    id="name" 
                    v-model="form.name" 
                    placeholder="Contoh: Rak A1, Etalase Depan" 
                    :class="{'p-invalid': submitted && !form.name}" 
                    autofocus 
                />
                <small class="text-red-500 mt-1 block" v-if="submitted && !form.name">
                    Nama rak wajib diisi.
                </small>
            </div>

            <div class="field">
                <label for="warehouse" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Lokasi Gudang
                </label>
                <Dropdown 
                    id="warehouse"
                    v-model="form.warehouseUuid" 
                    :options="warehouses" 
                    optionLabel="name" 
                    optionValue="uuid" 
                    placeholder="Pilih Gudang (Opsional)" 
                    class="w-full"
                    showClear
                />
                <small class="text-surface-500 mt-1 block">
                    Pilih di gudang mana rak ini berada. Kosongkan jika tidak spesifik.
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
                    :label="isEditMode ? 'Simpan Perubahan' : 'Tambah Rak'" 
                    icon="pi pi-check" 
                    size="small"
                    :loading="loading" 
                    @click="saveShelve" 
                />
            </div>
        </template>
    </Dialog>
</template>