<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    editData: Object
});

const emit = defineEmits(['update:visible', 'saved']);

const toast = useToast();
const promoService = usePromoService();
const productService = useProductService(); // Asumsi sudah ada
const memberService = useMemberService(); // Asumsi sudah ada

const processing = ref(false);
const products = ref([]);
const members = ref([]);

const form = reactive({
    uuid: null,
    name: '',
    code: '',
    promo_type: 'PRODUCT',
    discount_type: 'PERCENTAGE',
    discount_value: 0,
    target_uuid: null,
    start_date: null,
    end_date: null,
    is_active: true
});

onMounted(async () => {
    // Load master data untuk dropdown
    try {
        const prodRes = await productService.getAllProducts();
        products.value = prodRes?.data?.data || prodRes?.data || [];
        
        const memRes = await memberService.getMembers();
        members.value = memRes?.data?.data || memRes?.data || memRes || [];
    } catch(e) {}
});

watch(() => props.visible, (newVal) => {
    if (newVal) {
        if (props.editData) {
            Object.assign(form, props.editData);
            form.start_date = props.editData.start_date ? new Date(props.editData.start_date) : null;
            form.end_date = props.editData.end_date ? new Date(props.editData.end_date) : null;
        } else {
            Object.assign(form, { uuid: null, name: '', code: '', promo_type: 'PRODUCT', discount_type: 'PERCENTAGE', discount_value: 0, target_uuid: null, start_date: null, end_date: null, is_active: true });
        }
    }
});

const handleClose = () => emit('update:visible', false);

const savePromo = async () => {
    if (!form.name || !form.code || form.discount_value <= 0) {
        return toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Lengkapi form dengan benar', life: 3000 });
    }

    processing.value = true;
    try {
        const payload = {
            ...form,
            start_date: form.start_date ? form.start_date.toISOString().split('T')[0] : null,
            end_date: form.end_date ? form.end_date.toISOString().split('T')[0] : null,
        };

        if (form.uuid) {
            await promoService.updatePromo(form.uuid, payload);
        } else {
            await promoService.createPromo(payload);
        }

        toast.add({ severity: 'success', summary: 'Sukses', detail: 'Promo berhasil disimpan', life: 3000 });
        emit('saved');
        handleClose();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan sistem', life: 3000 });
    } finally {
        processing.value = false;
    }
};
</script>

<template>
    <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal header="Form Promo Diskon" class="w-full sm:w-[600px]">
        <div class="space-y-4 pt-2">
            <div>
                <label class="text-xs font-bold text-surface-600 block mb-1">Tipe Promo</label>
                <SelectButton v-model="form.promo_type" :options="[{label:'Promo Produk', value:'PRODUCT'}, {label:'Promo Member', value:'MEMBER'}]" optionLabel="label" optionValue="value" class="w-full" :pt="{ button: { class: 'flex-1' } }" />
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Nama Promo</label>
                    <InputText v-model="form.name" placeholder="Cth: Merdeka Sale" class="w-full" />
                </div>
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Kode Voucher</label>
                    <InputText v-model="form.code" placeholder="Cth: MRDK2024" class="w-full uppercase" />
                </div>
            </div>

            <div v-if="form.promo_type === 'PRODUCT'">
                <label class="text-xs font-bold text-surface-600 block mb-1">Terapkan ke Produk (Kosongkan = Semua Produk)</label>
                <Dropdown v-model="form.target_uuid" :options="products" optionLabel="name" optionValue="uuid" placeholder="Pilih Produk" filter showClear class="w-full" />
            </div>
            <div v-else-if="form.promo_type === 'MEMBER'">
                <label class="text-xs font-bold text-surface-600 block mb-1">Terapkan ke Member (Kosongkan = Semua Member)</label>
                <Dropdown v-model="form.target_uuid" :options="members" optionLabel="name" optionValue="uuid" placeholder="Pilih Member" filter showClear class="w-full" />
            </div>

            <div class="grid grid-cols-2 gap-4 bg-surface-50 p-4 rounded-xl border border-surface-200">
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Jenis Potongan</label>
                    <Dropdown v-model="form.discount_type" :options="[{label:'Persentase (%)', value:'PERCENTAGE'}, {label:'Nominal (Rp)', value:'FIXED'}]" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Nilai Potongan</label>
                    <InputNumber v-model="form.discount_value" :suffix="form.discount_type === 'PERCENTAGE' ? ' %' : ''" :prefix="form.discount_type === 'FIXED' ? 'Rp ' : ''" class="w-full" inputClass="!font-bold" />
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Tanggal Mulai (Opsional)</label>
                    <Calendar v-model="form.start_date" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>
                <div>
                    <label class="text-xs font-bold text-surface-600 block mb-1">Tanggal Selesai (Opsional)</label>
                    <Calendar v-model="form.end_date" dateFormat="dd/mm/yy" class="w-full" showIcon />
                </div>
            </div>
            
            <div class="flex items-center gap-2 mt-2">
                <Checkbox v-model="form.is_active" :binary="true" inputId="active" />
                <label for="active" class="text-sm font-semibold cursor-pointer">Promo Aktif</label>
            </div>
        </div>

        <template #footer>
            <Button label="Batal" severity="secondary" text @click="handleClose" />
            <Button label="Simpan Promo" icon="pi pi-check" severity="success" @click="savePromo" :loading="processing" />
        </template>
    </Dialog>
</template>