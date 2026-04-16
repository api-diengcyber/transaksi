<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import PromoCreateModal from '~/components/promo/PromoCreateModal.vue';

const toast = useToast();
const promoService = usePromoService();

const promos = ref([]);
const loading = ref(true);
const showModal = ref(false);
const editData = ref(null);

const loadData = async () => {
    loading.value = true;
    try {
        const res = await promoService.getPromos();
        promos.value = res?.data?.data || res?.data || res || [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal memuat data promo' });
    } finally {
        loading.value = false;
    }
};

const openCreate = () => {
    editData.value = null;
    showModal.value = true;
};

const openEdit = (data) => {
    editData.value = { ...data };
    showModal.value = true;
};

const formatValue = (data) => {
    if (data.discount_type === 'PERCENTAGE') return `${data.discount_value}%`;
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(data.discount_value);
};

onMounted(() => loadData());
</script>

<template>
    <div class="p-6 bg-surface-50 min-h-screen">
        <div class="flex justify-between items-center mb-6">
            <div>
                <h1 class="text-2xl font-bold text-surface-900">Manajemen Promo</h1>
                <p class="text-sm text-surface-500">Kelola promo diskon untuk Produk maupun Member.</p>
            </div>
            <Button label="Buat Promo Baru" icon="pi pi-plus" severity="primary" @click="openCreate" class="!rounded-xl" />
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
            <DataTable :value="promos" :loading="loading" paginator :rows="10" responsiveLayout="scroll" class="text-sm">
                <template #empty>
                    <div class="p-8 text-center text-surface-500">Belum ada promo yang dibuat.</div>
                </template>

                <Column field="name" header="Nama Promo" sortable>
                    <template #body="{data}">
                        <span class="font-bold text-surface-800">{{ data.name }}</span>
                    </template>
                </Column>
                <Column field="code" header="Kode" sortable>
                    <template #body="{data}">
                        <Tag :value="data.code" severity="info" class="!font-mono !px-2" />
                    </template>
                </Column>
                <Column field="promo_type" header="Tipe" sortable>
                    <template #body="{data}">
                        <Badge :value="data.promo_type === 'PRODUCT' ? 'PRODUK' : 'MEMBER'" :severity="data.promo_type === 'PRODUCT' ? 'warning' : 'success'" />
                    </template>
                </Column>
                <Column header="Nilai Diskon">
                    <template #body="{data}">
                        <span class="font-black text-emerald-600">{{ formatValue(data) }}</span>
                    </template>
                </Column>
                <Column field="is_active" header="Status" sortable>
                    <template #body="{data}">
                        <Tag :value="data.is_active ? 'Aktif' : 'Nonaktif'" :severity="data.is_active ? 'success' : 'danger'" />
                    </template>
                </Column>
                <Column header="Aksi" alignFrozen="right">
                    <template #body="{data}">
                        <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openEdit(data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <PromoCreateModal v-model:visible="showModal" :editData="editData" @saved="loadData" />
    </div>
</template>