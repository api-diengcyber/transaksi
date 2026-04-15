<template>
    <div class="flex flex-col gap-4">
        <div>
            <SelectButton
                v-model="internalValue.paymentType"
                :options="paymentTypeOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full shadow-sm"
                :pt="{ button: { class: '!text-sm !font-bold !py-3 flex-1' } }"
                @change="handleTypeChange"
            />
        </div>

        <div class="bg-surface-50 p-5 rounded-2xl border border-surface-200">
            
            <div v-if="isCredit" class="space-y-5 animate-fade-in-down mb-5">
                <div v-if="!hasCustomer" class="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-200 flex items-center gap-2 shadow-sm">
                    <i class="pi pi-exclamation-triangle text-lg"></i> {{ type === 'sale' ? 'Nama Pelanggan' : 'Supplier' }} wajib diisi untuk transaksi kredit.
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs font-bold text-orange-700 uppercase mb-2 block">Jatuh Tempo <span class="text-red-500">*</span></label>
                        <Calendar v-model="internalValue.dueDate" dateFormat="dd/mm/yy" :minDate="new Date()" showIcon class="w-full shadow-sm" inputClass="!text-sm" placeholder="Pilih Tanggal..." />
                    </div>
                    <div>
                        <label class="text-xs font-bold text-surface-600 uppercase block mb-2">Uang Muka / DP (Opsional)</label>
                        <InputNumber v-model="internalValue.cashAmount" mode="currency" currency="IDR" locale="id-ID" class="w-full shadow-sm" :max="grandTotal" inputClass="!text-lg !font-black !py-2 !text-orange-600 focus:!ring-orange-500 focus:border-orange-500" />
                    </div>
                </div>
            </div>

            <div v-if="!isCredit" class="mb-5 animate-fade-in-down">
                <label class="text-[11px] font-bold text-surface-500 uppercase block mb-2">Nominal Diterima</label>
                <InputNumber 
                    v-model="internalValue.cashAmount" 
                    mode="currency" 
                    currency="IDR" 
                    locale="id-ID" 
                    class="w-full shadow-sm" 
                    inputClass="!text-4xl !py-4 !font-black !text-center text-emerald-600 focus:!ring-emerald-500 focus:border-emerald-500" 
                    autofocus
                />

                <div v-if="type === 'sale' && selectedMethodCategory === 'CASH'" class="grid grid-cols-4 gap-3 mt-4">
                    <Button label="Uang Pas" outlined severity="success" size="small" class="!font-bold !py-2 shadow-sm bg-white" @click="setCash(grandTotal)" />
                    <Button label="20.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="setCash(20000)" />
                    <Button label="50.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="setCash(50000)" />
                    <Button label="100.000" outlined severity="secondary" size="small" class="!font-bold font-mono !py-2 shadow-sm bg-white" @click="setCash(100000)" />
                </div>
            </div>

            <div v-if="!isCredit || (isCredit && internalValue.cashAmount > 0)" class="animate-fade-in-down space-y-4">
                <Divider v-if="isCredit" type="dashed" class="!my-2" />
                
                <div>
                    <label class="text-xs font-bold text-surface-600 uppercase block mb-3">
                        {{ isCredit ? 'Metode Pembayaran DP' : 'Pilih Cara Bayar' }}
                    </label>
                    <div v-if="loadingMethods" class="text-surface-500 text-xs flex items-center gap-2"><i class="pi pi-spin pi-spinner"></i> Memuat metode pembayaran...</div>
                    <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div v-for="method in methods" :key="method.uuid"
                             @click="internalValue.paymentMethodUuid = method.uuid"
                             class="cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center text-center transition-all shadow-sm h-[88px] relative overflow-hidden"
                             :class="internalValue.paymentMethodUuid === method.uuid ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-surface-200 hover:border-primary-300'">
                            
                            <div v-if="internalValue.paymentMethodUuid === method.uuid" class="absolute top-0 right-0 w-0 h-0 border-t-[24px] border-l-[24px] border-t-primary-500 border-l-transparent"></div>
                            <i v-if="internalValue.paymentMethodUuid === method.uuid" class="pi pi-check text-[10px] text-white absolute top-1 right-1 z-10"></i>

                            <i v-if="method.category === 'CASH'" class="pi pi-money-bill text-2xl mb-1.5 text-emerald-500"></i>
                            <i v-else-if="method.category === 'BANK'" class="pi pi-building-columns text-2xl mb-1.5 text-blue-500"></i>
                            <i v-else-if="method.category === 'QRIS'" class="pi pi-qrcode text-2xl mb-1.5 text-red-500"></i>
                            <i v-else class="pi pi-wallet text-2xl mb-1.5 text-purple-500"></i>

                            <span class="text-xs font-bold text-surface-800 leading-tight line-clamp-2 px-1">{{ method.name }}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-else-if="isCredit && internalValue.cashAmount === 0" class="mt-4 p-4 bg-orange-50 border border-orange-200 border-dashed rounded-xl flex items-center justify-center animate-fade-in-down">
                <span class="text-sm font-semibold text-orange-600">Piutang Penuh (Tanpa Uang Muka)</span>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { usePaymentMethodService } from '~/composables/usePaymentMethodService';

const props = defineProps({
    modelValue: { type: Object, required: true },
    grandTotal: { type: Number, required: true },
    type: { type: String, default: 'sale' },
    hasCustomer: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const paymentService = usePaymentMethodService();
const loadingMethods = ref(true);
const methods = ref([]);
const internalValue = ref({ ...props.modelValue });

const fetchMethods = async () => {
    loadingMethods.value = true;
    try {
        const res = await paymentService.getAll();
        const data = Array.isArray(res) ? res : res.data || [];
        // Mengurutkan metode pembayaran (asumsi ada field urutan dari backend, jika tidak akan tetap berurutan)
        methods.value = data.filter(m => m.is_active).sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

        // Set default to first CASH method if nothing selected
        if (!internalValue.value.paymentMethodUuid && methods.value.length > 0) {
            const defaultMethod = methods.value.find(m => m.category === 'CASH') || methods.value[0];
            internalValue.value.paymentMethodUuid = defaultMethod.uuid;
            internalValue.value.paymentMethodCode = defaultMethod.code;
        }
    } catch (e) {
        console.error('Gagal load payment methods', e);
    } finally {
        loadingMethods.value = false;
    }
};

onMounted(() => fetchMethods());

watch(() => props.modelValue, (newVal) => {
    internalValue.value = { ...newVal };
}, { deep: true });

watch(() => internalValue.value, (newVal) => {
    emit('update:modelValue', newVal);
}, { deep: true });

watch(() => internalValue.value.paymentMethodUuid, (newUuid) => {
    const m = methods.value.find(x => x.uuid === newUuid);
    if (m) internalValue.value.paymentMethodCode = m.code;
});

const isCredit = computed(() => internalValue.value.paymentType === 'CREDIT');

const paymentTypeOptions = computed(() => {
    if (props.type === 'sale') {
        return [{label:'Lunas (Bayar Penuh)', value:'CASH'}, {label:'Piutang (Kredit)', value:'CREDIT'}];
    } else {
        return [{label:'Lunas (Bayar Penuh)', value:'CASH'}, {label:'Hutang (Kredit)', value:'CREDIT'}];
    }
});

const handleTypeChange = () => {
    if (internalValue.value.paymentType === 'CASH') {
        internalValue.value.cashAmount = props.grandTotal;
    } else {
        internalValue.value.cashAmount = 0; // Default DP 0 saat pertama kali pindah ke kredit
        internalValue.value.dueDate = null;
    }
};

const setCash = (amt) => { internalValue.value.cashAmount = amt; };

const selectedMethodCategory = computed(() => {
    const m = methods.value.find(x => x.uuid === internalValue.value.paymentMethodUuid);
    return m ? m.category : 'CASH';
});
</script>

<style scoped>
.animate-fade-in-down { animation: fadeInDown 0.2s ease-out; }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>