<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: { type: Boolean, default: false },
    initialOrder: { type: Object, default: null } // Jika null = Create, jika ada objek = Edit
});

const emit = defineEmits(['update:visible', 'order-submitted']);

const productionService = useProductionService();
const toast = useToast();

const loading = ref(false);
const form = ref({
    name: '',
    notes: ''
});

// Judul Modal
const dialogTitle = computed(() => props.initialOrder ? 'Edit Produksi' : 'Buat Produksi Baru');

// Reset atau Isi Form saat modal dibuka
watch(() => props.visible, (newVal) => {
    if (newVal) {
        if (props.initialOrder) {
            // Mode Edit
            form.value = {
                name: props.initialOrder.name,
                notes: props.initialOrder.notes
            };
        } else {
            // Mode Create
            form.value = {
                name: '',
                notes: ''
            };
        }
    }
});

const closeModal = () => {
    emit('update:visible', false);
};

const submitForm = async () => {
    if (!form.value.name) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama produksi wajib diisi.', life: 3000 });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            name: form.value.name,
            notes: form.value.notes
        };

        if (props.initialOrder) {
            // Update
            await productionService.updateOrder(props.initialOrder.uuid, payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data produksi diperbarui', life: 3000 });
        } else {
            // Create
            await productionService.createOrder(payload);
            toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Produksi baru dibuat', life: 3000 });
        }

        emit('order-submitted'); // Beritahu parent untuk refresh data
        closeModal();

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal menyimpan data produksi', life: 3000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)" 
        :header="dialogTitle" 
        modal 
        class="w-full max-w-lg"
        :draggable="false"
    >
        <div class="flex flex-col gap-4 pt-2">
            <div class="flex flex-col gap-1">
                <label for="prod_name" class="font-semibold text-sm">Nama Produksi <span class="text-red-500">*</span></label>
                <InputText id="prod_name" v-model="form.name" placeholder="Contoh: Produksi Roti Kloter 1" class="w-full" autofocus />
            </div>

            <div class="flex flex-col gap-1">
                <label for="prod_notes" class="font-semibold text-sm">Catatan</label>
                <Textarea id="prod_notes" v-model="form.notes" rows="3" placeholder="Catatan tambahan..." class="w-full" autoResize />
            </div>
        </div>

        <template #footer>
            <Button label="Batal" text severity="secondary" @click="closeModal" />
            <Button :label="props.initialOrder ? 'Simpan Perubahan' : 'Buat Produksi'" icon="pi pi-check" :loading="loading" @click="submitForm" />
        </template>
    </Dialog>
</template>