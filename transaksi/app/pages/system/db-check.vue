<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

definePageMeta({ layout: 'blank' });

const router = useRouter();
const toast = useToast();
const config = useRuntimeConfig();

const loading = ref(false);
const result = ref(null); // 'success' atau 'error'
const message = ref('');

// Form state (Default bawaan XAMPP/Laragon)
const form = reactive({
    host: '127.0.0.1',
    port: 8889,
    username: 'root',
    password: 'root',
    database: 'transaksi'
});

const testConnection = async () => {
    if (!form.host || !form.port || !form.username || !form.database) {
        toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Host, Port, Username, dan Database wajib diisi!', life: 3000 });
        return;
    }

    loading.value = true;
    result.value = null;
    message.value = 'Mencoba terhubung ke MySQL...';

    try {
        // Hit endpoint API untuk test koneksi
        const response = await $fetch(`${config.public.apiBase}/system-update/test-db`, {
            method: 'POST',
            body: form
        });

        if (response.success) {
            result.value = 'success';
            message.value = 'Koneksi Berhasil! Database siap digunakan.';
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Koneksi database berhasil!', life: 3000 });
        } else {
            result.value = 'error';
            message.value = response.message || 'Gagal terhubung ke database.';
        }
    } catch (error) {
        result.value = 'error';
        message.value = error.response?._data?.message || error.message || 'API Server tidak dapat dihubungi.';
        toast.add({ severity: 'error', summary: 'Koneksi Gagal', detail: 'Periksa kembali parameter database.', life: 4000 });
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="min-h-screen bg-surface-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
        <Toast />
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div class="w-full max-w-lg bg-surface-0 rounded-3xl shadow-xl border border-surface-200 relative z-10 overflow-hidden">
            <div class="bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center shadow-inner mb-4">
                    <i class="pi pi-database text-2xl text-blue-400"></i>
                </div>
                <h1 class="text-xl font-bold">Diagnostik Database MySQL</h1>
                <p class="text-xs text-slate-400 mt-1 font-mono">Uji koneksi parameter global server MySQL</p>
            </div>

            <div class="p-6 md:p-8 flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-surface-600 uppercase">Host Address</label>
                        <InputText v-model="form.host" class="p-inputtext-sm w-full font-mono" placeholder="localhost / 127.0.0.1" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-surface-600 uppercase">Port</label>
                        <InputNumber v-model="form.port" class="p-inputtext-sm w-full font-mono" :useGrouping="false" placeholder="3306" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-surface-600 uppercase">Username</label>
                        <InputText v-model="form.username" class="p-inputtext-sm w-full font-mono" placeholder="root" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-surface-600 uppercase">Password</label>
                        <Password v-model="form.password" class="w-full font-mono" inputClass="w-full p-inputtext-sm" :feedback="false" toggleMask placeholder="(Kosongkan jika tidak ada)" />
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-bold text-surface-600 uppercase">Nama Database</label>
                    <InputText v-model="form.database" class="p-inputtext-sm w-full font-mono" placeholder="db_transaksi" />
                </div>

                <div v-if="result || loading" class="mt-4 p-4 rounded-xl border flex items-start gap-3 transition-all" :class="{
                    'bg-blue-50 border-blue-200 text-blue-700': loading,
                    'bg-emerald-50 border-emerald-200 text-emerald-700': result === 'success',
                    'bg-red-50 border-red-200 text-red-700': result === 'error'
                }">
                    <i class="pi mt-0.5" :class="{
                        'pi-spin pi-spinner': loading,
                        'pi-check-circle': result === 'success',
                        'pi-times-circle': result === 'error'
                    }"></i>
                    <div class="text-sm font-bold flex-1">{{ message }}</div>
                </div>
            </div>

            <div class="p-6 border-t border-surface-100 bg-surface-50 flex justify-between items-center">
                <Button label="Kembali" icon="pi pi-arrow-left" text severity="secondary" size="small" @click="router.push('/login')" class="!font-bold !text-xs" />
                <Button label="Uji Koneksi" icon="pi pi-bolt" severity="primary" size="small" @click="testConnection" :loading="loading" class="!font-bold !text-xs shadow-md" />
            </div>
        </div>
    </div>
</template>