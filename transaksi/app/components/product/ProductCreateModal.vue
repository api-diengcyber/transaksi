<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    productUuid: { type: String, default: null }
});

const emit = defineEmits(['update:visible', 'product-created', 'product-updated']);

// --- INJECT SERVICES ---
const productService = useProductService();
const toast = useToast();

// --- STATE ---
const submitted = ref(false);
const loading = ref(false);
const isEditMode = computed(() => !!props.productUuid);

// Data Utama (Nama & Barcode)
const product = reactive({ 
    name: '',
    barcode: '' 
});

// --- FORM MANAGEMENT ---

const initForm = () => {
    product.name = '';
    product.barcode = '';
    submitted.value = false;
};

// --- LOAD DATA ---
const loadProductData = async (uuid) => {
    loading.value = true;
    try {
        const response = await productService.getProduct(uuid);
        const data = response.data || response; 

        if (!data) throw new Error("Data produk kosong dari server");

        // Isi data ke form
        product.name = data.name || '';
        product.barcode = data.barcode || '';

    } catch (error) {
        console.error("Load Error:", error);
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data produk.' });
        emit('update:visible', false); 
    } finally {
        loading.value = false;
    }
};

// --- WATCHERS ---
watch(() => props.visible, async (val) => {
    if (val) {
        initForm();
        if (props.productUuid) {
            await loadProductData(props.productUuid);
        }
        // Opsional: Focus ke field nama saat modal terbuka
        // await nextTick();
        // document.getElementById('productNameInput')?.focus();
    }
});

// --- SAVE / UPDATE ---
const saveProduct = async () => {
    submitted.value = true;
    
    // Validasi Sederhana
    if (!product.name) {
        toast.add({ severity: 'warn', summary: 'Perhatian', detail: 'Nama produk wajib diisi' });
        return;
    }

    loading.value = true;
    try {
        // Payload (Kirim Nama & Barcode)
        const payload = {
            name: product.name,
            barcode: product.barcode // Kirim string kosong jika tidak diisi
        };

        if (isEditMode.value) {
            await productService.updateProduct(props.productUuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil diperbarui' });
            emit('product-updated');
        } else {
            await productService.createProduct(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Produk berhasil dibuat' });
            emit('product-created');
        }
        emit('update:visible', false);
    } catch (e) {
        console.error(e);
        const msg = e.response?._data?.message || e.message || 'Terjadi kesalahan sistem';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'" 
        :modal="true" 
        :style="{ width: '450px' }" 
        class="p-fluid bg-surface-0 rounded-xl overflow-hidden" 
        :pt="{ 
            header: { class: '!bg-surface-50 !border-b !border-surface-200 !py-4' },
            content: { class: '!py-6 !px-6' },
            footer: { class: '!bg-surface-50 !border-t !border-surface-200 !py-3 !px-6' }
        }"
    >
        <div class="flex flex-col gap-5">
            
            <div class="field">
                <label for="name" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Nama Produk <span class="text-red-500">*</span>
                </label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100 !border-surface-300">
                        <i class="pi pi-tag text-surface-500"></i>
                    </InputGroupAddon>
                    <InputText 
                        id="name" 
                        v-model="product.name" 
                        placeholder="Contoh: Kopi Kapal Api" 
                        :class="{'p-invalid': submitted && !product.name}" 
                        class="!border-surface-300 focus:!border-primary-500"
                        autofocus
                    />
                </InputGroup>
                <small class="text-red-500 text-xs mt-1 block" v-if="submitted && !product.name">
                    Nama produk wajib diisi.
                </small>
            </div>

            <div class="field">
                <label for="barcode" class="font-semibold text-sm mb-1.5 block text-surface-700">
                    Barcode / SKU
                </label>
                <InputGroup>
                    <InputGroupAddon class="!bg-surface-100 !border-surface-300">
                        <i class="pi pi-barcode text-surface-500"></i>
                    </InputGroupAddon>
                    <InputText 
                        id="barcode" 
                        v-model="product.barcode" 
                        placeholder="Scan atau ketik kode..." 
                        class="!border-surface-300 focus:!border-primary-500"
                    />
                </InputGroup>
                <small class="text-surface-400 text-xs mt-1 block">
                    Kosongkan jika tidak ada barcode.
                </small>
            </div>

        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button 
                    label="Batal" 
                    icon="pi pi-times" 
                    text 
                    severity="secondary" 
                    size="small" 
                    @click="emit('update:visible', false)" 
                />
                <Button 
                    :label="isEditMode ? 'Simpan Perubahan' : 'Simpan Produk'" 
                    icon="pi pi-check" 
                    size="small" 
                    @click="saveProduct" 
                    :loading="loading" 
                    severity="primary"
                />
            </div>
        </template>
    </Dialog>
</template>