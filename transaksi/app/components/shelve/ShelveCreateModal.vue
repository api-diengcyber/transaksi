<script setup>
import { computed, reactive, watch } from 'vue';

// Menerima props dari Parent (index.vue)
const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false
    },
    data: {
        type: Object,
        default: null
    },
    loading: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close', 'submit']);

// --- VISIBILITY BRIDGE ---
// Menghubungkan prop 'isOpen' dengan v-model Dialog PrimeVue
const visible = computed({
    get: () => props.isOpen,
    set: (val) => {
        if (!val) emit('close');
    }
});

// --- FORM STATE ---
const form = reactive({
    name: '',
    type: 'SHELF', // Default: Rak
    capacity: 100,
    description: '',
    isDefault: false,
});

// --- WATCHER ---
// Mengisi form saat tombol Edit diklik (props.data berubah)
watch(() => props.data, (newVal) => {
    if (newVal) {
        // Mode Edit
        form.name = newVal.name;
        form.type = newVal.type || 'SHELF';
        form.capacity = newVal.capacity || 0;
        form.description = newVal.description || '';
        form.isDefault = newVal.isDefault || false;
    } else {
        // Mode Create (Reset)
        form.name = '';
        form.type = 'SHELF';
        form.capacity = 100;
        form.description = '';
        form.isDefault = false;
    }
}, { immediate: true });

// --- SUBMIT ---
const handleSubmit = () => {
    emit('submit', { ...form });
};
</script>

<template>
    <Dialog 
        v-model:visible="visible" 
        modal 
        :header="data ? 'Edit Lokasi' : 'Tambah Lokasi Baru'" 
        :style="{ width: '500px' }" 
        :breakpoints="{ '960px': '75vw', '641px': '100vw' }"
        class="p-fluid bg-surface-0"
    >
        <div class="flex flex-col gap-4 mt-2">
            
            <div class="flex flex-col gap-2">
                <label for="name" class="font-semibold">Nama Lokasi</label>
                <InputText id="name" v-model="form.name" placeholder="Contoh: Rak Depan / Gudang A" autofocus />
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label class="font-semibold">Tipe</label>
                    <Dropdown 
                        v-model="form.type" 
                        :options="[{label: 'Rak Pajangan', value: 'SHELF'}, {label: 'Gudang Stok', value: 'WAREHOUSE'}]" 
                        optionLabel="label" 
                        optionValue="value"
                        placeholder="Pilih Tipe"
                        :disabled="data && data.isDefault" 
                    />
                    <small v-if="form.type === 'WAREHOUSE'" class="text-blue-600">Untuk stok penyimpanan.</small>
                    <small v-else class="text-emerald-600">Untuk display toko.</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="capacity" class="font-semibold">Kapasitas</label>
                    <InputNumber id="capacity" v-model="form.capacity" showButtons :min="0" suffix=" item" />
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <label for="desc" class="font-semibold">Deskripsi</label>
                <Textarea id="desc" v-model="form.description" rows="3" placeholder="Keterangan tambahan..." autoResize />
            </div>

            <Message v-if="form.isDefault" severity="warn" :closable="false">
                Ini adalah lokasi utama sistem. Beberapa pengaturan mungkin dikunci.
            </Message>

        </div>

        <template #footer>
            <Button label="Batal" icon="pi pi-times" text @click="visible = false" />
            <Button label="Simpan" icon="pi pi-check" @click="handleSubmit" :loading="loading" />
        </template>
    </Dialog>
</template>