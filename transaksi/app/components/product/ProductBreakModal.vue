<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    product: Object // Data produk lengkap termasuk units dan currentStock
});

const emit = defineEmits(['update:visible', 'saved']);

const toast = useToast();
const productService = useProductService(); // Pastikan composable ini ada
const loading = ref(false);

// State Form
const form = ref({
    sourceUnitUuid: null,
    targetUnitUuid: null,
    qtyToBreak: 1
});

// Filter Unit: Source hanya unit yang punya multiplier > 1 dan punya stok
const sourceOptions = computed(() => {
    if (!props.product || !props.product.units) return [];
    return props.product.units
        .filter(u => u.unitMultiplier > 1 && u.currentStock > 0)
        .map(u => ({
            label: `${u.unitName} (Stok: ${u.currentStock}, x${u.unitMultiplier})`,
            value: u.uuid,
            data: u
        }));
});

// Filter Unit: Target hanya unit yang multipliernya lebih kecil dari Source
const targetOptions = computed(() => {
    if (!props.product || !props.product.units || !form.value.sourceUnitUuid) return [];
    
    const sourceUnit = props.product.units.find(u => u.uuid === form.value.sourceUnitUuid);
    if (!sourceUnit) return [];

    return props.product.units
        .filter(u => u.unitMultiplier < sourceUnit.unitMultiplier)
        .map(u => ({
            label: `${u.unitName} (x${u.unitMultiplier})`,
            value: u.uuid,
            data: u
        }));
});

// Kalkulasi Preview Hasil
const previewResult = computed(() => {
    if (!form.value.sourceUnitUuid || !form.value.targetUnitUuid || !props.product) return null;
    
    const source = props.product.units.find(u => u.uuid === form.value.sourceUnitUuid);
    const target = props.product.units.find(u => u.uuid === form.value.targetUnitUuid);
    
    if (!source || !target) return 0;

    const ratio = source.unitMultiplier / target.unitMultiplier;
    return form.value.qtyToBreak * ratio;
});

// Reset form saat modal dibuka
watch(() => props.visible, (val) => {
    if (val) {
        form.value.sourceUnitUuid = null;
        form.value.targetUnitUuid = null;
        form.value.qtyToBreak = 1;
    }
});

watch(() => form.value.sourceUnitUuid, (val) => {
    form.value.targetUnitUuid = null;
    if (targetOptions.value.length > 0) {
        const smallest = targetOptions.value.sort((a,b) => a.data.unitMultiplier - b.data.unitMultiplier)[0];
        if(smallest) form.value.targetUnitUuid = smallest.value;
    }
});

const save = async () => {
    if (!form.value.sourceUnitUuid || !form.value.targetUnitUuid) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Pilih satuan asal dan tujuan' });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            productUuid: props.product.uuid,
            sourceUnitUuid: form.value.sourceUnitUuid,
            targetUnitUuid: form.value.targetUnitUuid,
            qtyToBreak: form.value.qtyToBreak
        };

        // Panggil API (Sesuaikan path jika berbeda di composable Anda)
        await productService.breakUnit(payload);

        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Stok berhasil dipecah' });
        emit('saved');
        emit('update:visible', false);
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message || 'Terjadi kesalahan' });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)"
        header="Pecah Satuan Stok" 
        modal 
        class="p-fluid" 
        :style="{ width: '450px' }"
    >
        <div class="field mb-4">
            <label class="font-bold mb-2 block">Satuan Asal (Yang akan dipecah)</label>
            <Dropdown 
                v-model="form.sourceUnitUuid" 
                :options="sourceOptions" 
                optionLabel="label" 
                optionValue="value" 
                placeholder="Pilih Satuan Besar (cth: BOX)"
                emptyMessage="Tidak ada satuan yang bisa dipecah"
            />
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4" v-if="form.sourceUnitUuid">
             <div class="field">
                <label class="font-bold mb-2 block">Jumlah Dipecah</label>
                <InputNumber v-model="form.qtyToBreak" :min="1" showButtons buttonLayout="horizontal" inputClass="text-center" />
            </div>
             <div class="field flex items-end pb-2 justify-center">
                <i class="pi pi-arrow-right text-2xl text-surface-400"></i>
            </div>
        </div>

        <div class="field mb-4" v-if="form.sourceUnitUuid">
            <label class="font-bold mb-2 block">Satuan Tujuan (Hasil Pecahan)</label>
            <Dropdown 
                v-model="form.targetUnitUuid" 
                :options="targetOptions" 
                optionLabel="label" 
                optionValue="value" 
                placeholder="Pilih Satuan Kecil (cth: PCS)"
            />
        </div>

        <div v-if="previewResult" class="bg-blue-50 p-3 rounded text-center border border-blue-100  mb-4">
            <span class="text-sm ">Estimasi Hasil:</span><br>
            <span class="text-xl font-bold text-blue-600 ">
                +{{ previewResult }} 
                {{ targetOptions.find(t => t.value === form.targetUnitUuid)?.label }}
            </span>
        </div>

        <template #footer>
            <Button label="Batal" icon="pi pi-times" text @click="emit('update:visible', false)" />
            <Button label="Proses Pecah" icon="pi pi-box" @click="save" :loading="loading" severity="help" />
        </template>
    </Dialog>
</template>