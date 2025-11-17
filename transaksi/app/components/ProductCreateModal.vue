<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

const productService = useProductService();
const toast = useToast();

const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

const product = reactive({ name: '', barcode: '' });
const createUnits = ref([]);
const unitOptions = ['PCS', 'BOX', 'KG', 'LITER', 'PACK', 'CARTON', 'DUS', 'LUSIN'];

const getAvailableOptions = (currentValue) => {
    const selectedUnits = createUnits.value
        .map(u => u.unitName)
        .filter(u => u !== currentValue && u !== null && u !== undefined);
    return unitOptions.filter(opt => !selectedUnits.includes(opt));
};

watch(() => props.visible, async (isVisible) => {
    if (isVisible) {
        if (props.productUuid) {
            await loadProductDetail(props.productUuid);
        } else {
            resetForm();
        }
    }
});

const loadProductDetail = async (uuid) => {
    loading.value = true;
    try {
        const data = await productService.getProductDetail(uuid);
        if (data) {
            product.name = data.name;
            const priceList = data.price || data.prices || [];
            const stockList = data.stock || [];
            createUnits.value = data.units.map(u => {
                const priceObj = priceList.find(p => p.unitUuid === u.uuid);
                const stockObj = stockList.find(s => s.unitUuid === u.uuid);
                return {
                    uuid: u.uuid,
                    unitName: u.unitName,
                    unitMultiplier: u.unitMultiplier,
                    barcode: u.barcode || '',
                    price: priceObj ? Number(priceObj.price) : 0,
                    stock: stockObj ? Number(stockObj.qty) : 0,
                    isDefault: data.defaultUnitUuid === u.uuid
                };
            });
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal load detail', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const resetForm = () => {
    product.name = '';
    product.barcode = '';
    createUnits.value = [{ uuid: null, unitName: 'PCS', unitMultiplier: 1, barcode: '', price: 0, stock: 0, isDefault: true }];
    submitted.value = false;
};

const saveProduct = async () => {
    submitted.value = true;
    if (!product.name) return;
    if (createUnits.value.length === 0) return;

    loading.value = true;
    try {
        if (isEditMode.value) {
            await productService.updateProduct(props.productUuid, product.name);
            for (const row of createUnits.value) {
                if (!row.uuid) {
                    const newUnit = await productService.addUnit(props.productUuid, {
                        unitName: row.unitName, unitMultiplier: row.unitMultiplier, barcode: row.barcode, setAsDefault: row.isDefault
                    });
                    if (row.price > 0) await productService.addPrice(props.productUuid, { price: row.price, unitUuid: newUnit.uuid, setAsDefault: row.isDefault });
                    if (row.stock > 0) await productService.addStock(props.productUuid, row.stock);
                } else {
                    if (row.price > 0) {
                        await productService.addPrice(props.productUuid, { price: row.price, unitUuid: row.uuid, setAsDefault: row.isDefault });
                    }
                }
            }
            toast.add({ severity: 'success', summary: 'Updated', detail: 'Produk diperbarui', life: 3000 });
            emit('product-updated');
        } else {
            const payload = {
                name: product.name,
                units: createUnits.value
            };
            const newProd = await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk dibuat', life: 3000 });
            emit('product-created', newProd);
        }
        closeDialog();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: e.message, life: 3000 });
    } finally {
        loading.value = false;
    }
};

const closeDialog = () => {
    emit('update:visible', false);
};

const addCreateUnitRow = () => {
    const available = getAvailableOptions(null);
    if (available.length === 0) { toast.add({ severity: 'warn', summary: 'Habis', detail: 'Semua satuan digunakan', life: 3000 }); return; }
    createUnits.value.push({ uuid: null, unitName: available[0], unitMultiplier: 1, barcode: '', price: 0, stock: 0, isDefault: createUnits.value.length === 0 });
};

const removeCreateUnitRow = (index) => {
    if (createUnits.value.length === 1) return;
    createUnits.value.splice(index, 1);
};

const setDefaultUnit = (index) => { createUnits.value.forEach((u, i) => u.isDefault = (i === index)); };
</script>

<template>
    <Dialog :visible="visible" @update:visible="val => emit('update:visible', val)" 
            :header="isEditMode ? 'Edit Produk' : 'Buat Produk Baru'" 
            :modal="true" :style="{ width: '900px' }" 
            class="p-fluid compact-dialog"
            :pt="{ content: { class: '!py-2' } }"
    >
        <div class="bg-surface-50 dark:bg-surface-900 p-3 rounded-lg border border-surface-200 dark:border-surface-700 mb-4">
            <div class="grid grid-cols-1 gap-2">
                <div class="field mb-0">
                    <label class="font-bold text-xs mb-1 block text-surface-600 dark:text-surface-300">Nama Produk <span class="text-red-500">*</span></label>
                    <InputText v-model.trim="product.name" required="true" :class="{'p-invalid': submitted && !product.name}" placeholder="Contoh: Indomie Goreng" class="w-full !h-9 text-sm" />
                    <small class="text-red-500 text-[10px]" v-if="submitted && !product.name">Wajib diisi.</small>
                </div>
            </div>
        </div>

        <div class="flex justify-between items-center mb-2 border-b border-surface-100 pb-2">
            <span class="text-primary-600 font-bold text-xs uppercase tracking-wide">Konfigurasi Satuan</span>
            <Button label="Tambah Satuan" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addCreateUnitRow" class="!py-1 !px-2 !text-xs !h-7" />
        </div>

        <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden shadow-sm">
            <table class="w-full text-xs">
                <thead class="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-200 text-[10px] uppercase font-bold">
                    <tr>
                        <th class="p-2 text-center w-8 border-b dark:border-surface-700" title="Default">Def</th>
                        <th class="p-2 w-28 border-b dark:border-surface-700">Satuan</th>
                        <th class="p-2 w-16 border-b dark:border-surface-700" title="Multiplier">Kali</th>
                        <th class="p-2 border-b dark:border-surface-700">Barcode</th>
                        <th class="p-2 w-32 border-b dark:border-surface-700">Harga Jual</th>
                        <th class="p-2 w-20 border-b dark:border-surface-700">Stok</th>
                        <th class="p-2 text-center w-8 border-b dark:border-surface-700"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-surface-100 dark:divide-surface-800 bg-white dark:bg-surface-900">
                        <tr v-for="(row, index) in createUnits" :key="index" class="hover:bg-surface-50 dark:hover:bg-surface-800/50">
                        <td class="p-1.5 text-center align-middle">
                            <RadioButton v-model="row.isDefault" :value="true" name="defGroup" @change="setDefaultUnit(index)" class="scale-75" />
                        </td>
                        
                        <td class="p-1.5 align-middle">
                            <Dropdown v-model="row.unitName" :options="getAvailableOptions(row.unitName)" class="w-full !h-8 text-xs custom-dropdown" :disabled="!!row.uuid" placeholder="Pilih" />
                        </td>

                        <td class="p-1.5 align-middle">
                            <InputNumber v-model="row.unitMultiplier" :min="1" class="w-full !h-8" inputClass="!text-xs !text-center !p-1" :disabled="row.isDefault || !!row.uuid" />
                        </td>

                        <td class="p-1.5 align-middle">
                            <div class="p-inputgroup flex-1 !h-8">
                                <span class="p-inputgroup-addon !px-2 !bg-surface-50 border-r-0 !min-w-[2rem]">
                                    <i class="pi pi-barcode text-surface-400 text-xs"></i>
                                </span>
                                <InputText v-model="row.barcode" class="w-full !text-xs !p-1" :disabled="!!row.uuid && isEditMode" placeholder="Scan..." />
                            </div>
                        </td>

                        <td class="p-1.5 align-middle">
                            <InputNumber v-model="row.price" mode="currency" currency="IDR" locale="id-ID" class="w-full !h-8" inputClass="!text-xs !text-right !p-1" placeholder="0" />
                        </td>

                        <td class="p-1.5 align-middle">
                            <InputNumber v-model="row.stock" :min="0" class="w-full !h-8" inputClass="!text-xs !text-center !p-1" :disabled="!!row.uuid && isEditMode" placeholder="0" />
                        </td>

                        <td class="p-1.5 text-center align-middle">
                            <Button icon="pi pi-trash" text rounded severity="danger" size="small" 
                                @click="removeCreateUnitRow(index)" 
                                :disabled="createUnits.length === 1" 
                                class="!w-6 !h-6 !p-0"
                            />
                        </td>
                        </tr>
                </tbody>
            </table>
        </div>

        <div v-if="isEditMode" class="mt-2 text-[10px] text-orange-600 flex items-center gap-1">
            <i class="pi pi-info-circle text-[10px]"></i>
            <span>Stok & Barcode lama dikunci (Edit Mode).</span>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-2 border-t border-surface-100 mt-2">
                <Button label="Batal" icon="pi pi-times" text @click="closeDialog" severity="secondary" size="small" />
                <Button :label="isEditMode ? 'Simpan' : 'Buat Produk'" icon="pi pi-check" @click="saveProduct" :loading="loading" size="small" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* Custom styling untuk memperkecil tinggi input PrimeVue secara paksa */
:deep(.custom-dropdown .p-dropdown-label) {
    padding: 4px 8px;
    font-size: 0.75rem; /* text-xs */
}
:deep(.p-inputnumber-input) {
    padding: 4px 8px;
}
</style>