<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    userData: { type: Object, default: null }, // Data pengguna untuk mode edit
    roles: { type: Array, default: () => [] },  // Daftar semua role yang tersedia dari backend
});

const emit = defineEmits(['update:visible', 'saved']);

// Asumsi: useUserService() sudah dibuat (atau akan dibuat)
const userService = useUserService();
const toast = useToast();

const loading = ref(false);
const submitted = ref(false);

const form = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Role disimpan sebagai array UUID/Value role
    roleValues: [], 
    // Field opsional lainnya jika ada
});

const isEditMode = computed(() => !!props.userData);

// Mengonversi daftar roles (contoh: ['ADMIN', 'CASHIER']) ke format yang dibutuhkan Dropdown
const roleOptions = computed(() => {
    // Kita asumsikan role dari backend berupa array of objects { uuid: string, role: string }
    return props.roles.map(r => ({
        label: r.role,
        value: r.role // Menggunakan string role sebagai value untuk form
    }));
});

// --- LOGIC FORMULIR ---

const resetForm = () => {
    form.username = '';
    form.email = '';
    form.password = '';
    form.confirmPassword = '';
    form.roleValues = [];
    submitted.value = false;
};

const populateForm = () => {
    if (props.userData) {
        form.username = props.userData.username || '';
        form.email = props.userData.email || '';
        // Mode edit TIDAK memuat atau memerlukan password kecuali diubah
        form.password = ''; 
        form.confirmPassword = '';
        // Map roles ke array value
        form.roleValues = (props.userData.roles || []).map(r => r.role); 
    } else {
        resetForm();
    }
};

watch(() => props.visible, (val) => {
    if (val) {
        populateForm();
    }
});


const handleSave = async () => {
    submitted.value = true;

    // Validasi Dasar
    if (!form.username || form.roleValues.length === 0) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Username dan Role wajib diisi.', life: 3000 });
        return;
    }

    // Validasi Password (Hanya berlaku jika mode Edit DAN password diisi, atau mode Create)
    if ((!isEditMode.value || form.password) && form.password !== form.confirmPassword) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Password dan Konfirmasi tidak cocok.', life: 3000 });
        return;
    }
    
    if (!isEditMode.value && form.password.length < 6) {
        toast.add({ severity: 'error', summary: 'Validasi', detail: 'Password minimal 6 karakter.', life: 3000 });
        return;
    }

    loading.value = true;
    try {
        const payload = {
            username: form.username,
            email: form.email,
            // Jika mode edit dan password diisi, kirim password baru. Jika create, wajib dikirim.
            ...(form.password && { password: form.password }), 
            
            // [CATATAN PENTING] Anda harus memastikan backend menerima role dalam format ini.
            // Di sini kita asumsikan backend menerima array string role (ex: ['ADMIN', 'CASHIER'])
            roles: form.roleValues 
        };

        if (isEditMode.value) {
            await userService.updateUser(props.userData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data pengguna diperbarui.', life: 3000 });
        } else {
            // Pada mode create, password harus ada
            if (!form.password) {
                 toast.add({ severity: 'error', summary: 'Validasi', detail: 'Password wajib diisi untuk pengguna baru.', life: 3000 });
                 return;
            }
            await userService.createUser(payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Pengguna baru berhasil dibuat.', life: 3000 });
        }

        emit('saved');
        closeDialog();
    } catch (e) {
        console.error(e);
        const msg = e.response?._data?.message || 'Terjadi kesalahan saat menyimpan.';
        toast.add({ severity: 'error', summary: 'Gagal', detail: msg, life: 3000 });
    } finally {
        loading.value = false;
    }
};

const closeDialog = () => {
    emit('update:visible', false);
    resetForm();
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="val => emit('update:visible', val)" 
        :header="isEditMode ? 'Edit Pengguna' : 'Buat Pengguna Baru'" 
        :modal="true" 
        :style="{ width: '550px' }" 
        class="p-fluid"
    >
        <div class="flex flex-col gap-6 pt-2">
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="field">
                    <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">Username <span class="text-red-500">*</span></label>
                    <InputText 
                        v-model="form.username" 
                        placeholder="Contoh: ujangkasir" 
                        :class="{'p-invalid': submitted && !form.username}" 
                        autofocus 
                    />
                </div>

                <div class="field">
                    <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">Email (Opsional)</label>
                    <InputText 
                        v-model="form.email" 
                        placeholder="email@toko.com" 
                        type="email" 
                    />
                </div>
            </div>

            <div class="field">
                <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">Role Pengguna <span class="text-red-500">*</span></label>
                <MultiSelect 
                    v-model="form.roleValues" 
                    :options="roleOptions" 
                    optionLabel="label" 
                    optionValue="value" 
                    placeholder="Pilih Role (Admin, Kasir, dll)"
                    display="chip"
                    filter
                    class="w-full"
                    :class="{'p-invalid': submitted && form.roleValues.length === 0}"
                />
            </div>
            
            <div class="space-y-4 pt-2 border-t border-surface-100 dark:border-surface-700">
                <p class="text-xs text-surface-500 italic mb-3">
                    {{ isEditMode ? 'Isi hanya jika Anda ingin mengganti password.' : 'Password wajib diisi untuk pengguna baru.' }}
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="field">
                        <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">
                            Password {{ isEditMode ? 'Baru' : '' }}
                        </label>
                        <Password 
                            v-model="form.password" 
                            :feedback="false" 
                            toggleMask 
                            placeholder="Min. 6 karakter"
                            inputClass="w-full" 
                        />
                    </div>
                    <div class="field">
                        <label class="text-sm font-bold text-surface-700 dark:text-surface-200 mb-1 block">Konfirmasi Password</label>
                        <Password 
                            v-model="form.confirmPassword" 
                            :feedback="false" 
                            toggleMask 
                            placeholder="Ulangi password"
                            inputClass="w-full"
                            :class="{'p-invalid': form.password !== form.confirmPassword && (form.password || form.confirmPassword)}"
                        />
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="flex justify-end gap-2 pt-4 border-t border-surface-100 dark:border-surface-700 mt-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="closeDialog" />
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Pengguna'" icon="pi pi-check" :loading="loading" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>