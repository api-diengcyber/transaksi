<script setup>
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import { useStoreService } from '~/composables/useStoreService';
import { useAuthStore } from '~/stores/auth.store';

const props = defineProps({
    settings: { type: Object, required: true },
    loading: { type: Boolean, default: false }
});

const emit = defineEmits(['update:settings', 'refresh-store']);

const storeService = useStoreService();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const logoLoading = ref(false);

const currentLogoUrl = computed(() => {
    const urlPath = props.settings.store_logo_url;
    const fallback = "https://placehold.co/150x150/e0f2f1/047857?text=Logo+Store";
    if (!urlPath) return fallback;
    const config = useRuntimeConfig();
    const baseUrl = config.public.apiBase.replace("/api", "");
    return urlPath.startsWith("http") ? urlPath : `${baseUrl}${urlPath}`;
});

const onLogoUpload = async (event) => {
    const file = event.files ? event.files[0] : null;
    if (!file) return;

    logoLoading.value = true;
    try {
        const response = await storeService.uploadStoreLogo(file);
        if (response.logoUrl) {
            props.settings.store_logo_url = response.logoUrl;
        }
        emit('refresh-store'); // Minta parent refresh data user/store
        toast.add({ severity: "success", summary: "Sukses", detail: "Logo berhasil diunggah!", life: 3000 });
    } catch (e) {
        toast.add({ severity: "error", summary: "Gagal", detail: e.message || "Gagal upload.", life: 3000 });
    } finally {
        logoLoading.value = false;
        event.target.value = ""; // Reset input
    }
};

const onRemoveLogo = () => {
    confirm.require({
        message: "Hapus logo toko saat ini?",
        header: "Hapus Logo",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: () => {
            props.settings.store_logo_url = null;
        },
    });
};
</script>

<template>
    <div class="animate-fade-in space-y-6">
        <div class="card-section">
            <h3 class="section-title">Logo Toko</h3>
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div class="shrink-0 relative">
                    <img :src="currentLogoUrl" alt="Store Logo" class="w-24 h-24 object-cover rounded-full shadow-md border-4 border-surface-0 " />
                    <div v-if="logoLoading" class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="6" class="text-white" />
                    </div>
                </div>

                <div class="flex flex-col items-center sm:items-start">
                    <p class="text-sm text-surface-600  mb-3">
                        Unggah logo baru (Max 1MB, format: JPG/PNG).
                    </p>
                    <div class="flex gap-2">
                        <FileUpload mode="basic" name="file" accept="image/*" :maxFileSize="1000000" @uploader="onLogoUpload" customUpload :auto="true" chooseLabel="Unggah Logo" :disabled="logoLoading || loading" class="!p-0">
                            <template #choosebutton="{ chooseCallback, label, icon }">
                                <Button :label="label" :icon="icon" @click="chooseCallback" size="small" :severity="logoLoading ? 'secondary' : 'primary'" :disabled="logoLoading || loading" />
                            </template>
                        </FileUpload>
                        <Button v-if="settings.store_logo_url" label="Hapus" icon="pi pi-trash" severity="danger" size="small" @click="onRemoveLogo" :disabled="loading" />
                    </div>
                </div>
            </div>
        </div>

        <div class="card-section">
            <h3 class="section-title">Identitas Utama</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="field">
                    <label>Nama Toko</label>
                    <InputText v-model="settings.store_name" class="w-full" placeholder="Contoh: Toko Makmur Jaya" />
                </div>
                <div class="field">
                    <label>No. Telepon</label>
                    <InputText v-model="settings.store_phone" class="w-full" placeholder="0812..." />
                </div>
                <div class="field md:col-span-2">
                    <label>Alamat Lengkap</label>
                    <Textarea v-model="settings.store_address" rows="3" class="w-full" />
                </div>
                <div class="field md:col-span-2">
                    <label>Pesan Kaki (Footer Note Struk)</label>
                    <InputText v-model="settings.store_footer_msg" class="w-full" placeholder="Contoh: Terimakasih telah berbelanja!" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card-section { @apply bg-surface-0 rounded-xl shadow-sm border border-surface-200  p-6; }
.section-title { @apply text-base font-bold  mb-4 pb-2 border-b border-surface-100 ; }
.field label { @apply text-xs font-bold text-surface-500 uppercase tracking-wide mb-1.5 block; }
.animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>