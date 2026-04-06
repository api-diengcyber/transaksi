<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

const props = defineProps({
    visible: Boolean,
    userData: { type: Object, default: null }, // Data pengguna untuk mode edit
    // Kita tetap biarkan props roles untuk jaga-jaga, tapi kita buatkan state lokal
    roles: { type: Array, default: () => [] },  
});

const emit = defineEmits(['update:visible', 'saved']);

// Asumsi: useUserService() memiliki endpoint untuk CRUD user
const userService = useUserService();
const toast = useToast();

const loading = ref(false);
const submitted = ref(false);
const localRoles = ref([]); // State untuk menyimpan daftar role dari API

const form = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleValues: [], 
});

const isEditMode = computed(() => !!props.userData);

// Mengonversi daftar roles agar formatnya cocok dengan Dropdown (Menangani .name atau .role)
const roleOptions = computed(() => {
    // Gabungkan props dari parent (jika ada) dengan data lokal dari API
    const sourceRoles = localRoles.value.length > 0 ? localRoles.value : props.roles;
    
    return sourceRoles.map(r => ({
        label: r.name || r.role || r, // Otomatis membaca field 'name' atau 'role'
        value: r.uuid || r.name || r.role || r // Simpan UUID atau nama role tergantung kebutuhan backend
    }));
});

// --- LOGIC FORMULIR ---
const loadRoles = async () => {
    try {
        // Coba panggil endpoint getRoles() jika sudah Anda buat di useUserService.ts
        if (userService.getAllRoles) {
            const res = await userService.getAllRoles();
            localRoles.value = res?.data?.data || res?.data || res || [];
        } else {
            // FALLBACK STATIS: Jika API getRoles belum ada, tampilkan role default
            localRoles.value = [
                { uuid: 'ADMIN', name: 'Admin / Pemilik' },
                { uuid: 'CASHIER', name: 'Kasir' },
                { uuid: 'WAREHOUSE', name: 'Gudang' }
            ];
        }
    } catch (e) {
        console.error("Gagal memuat role", e);
    }
};

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
        form.password = ''; 
        form.confirmPassword = '';
        // Map roles menangani .name atau .role
        form.roleValues = (props.userData.roles || []).map(r => r.uuid || r.name || r.role); 
    } else {
        resetForm();
    }
};

// Panggil loadRoles dan populateForm setiap kali modal terbuka
watch(() => props.visible, async (val) => {
    if (val) {
        await loadRoles();
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

    // Validasi Password
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
            ...(form.password && { password: form.password }), 
            roles: form.roleValues 
        };

        if (isEditMode.value) {
            await userService.updateUser(props.userData.uuid, payload);
            toast.add({ severity: 'success', summary: 'Sukses', detail: 'Data pengguna diperbarui.', life: 3000 });
        } else {
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
                    <label class="text-sm font-bold mb-1 block">Username <span class="text-red-500">*</span></label>
                    <InputText 
                        v-model="form.username" 
                        placeholder="Contoh: ujangkasir" 
                        :class="{'p-invalid': submitted && !form.username}" 
                        autofocus 
                    />
                </div>

                <div class="field">
                    <label class="text-sm font-bold mb-1 block">Email (Opsional)</label>
                    <InputText 
                        v-model="form.email" 
                        placeholder="email@toko.com" 
                        type="email" 
                    />
                </div>
            </div>

            <div class="field">
                <label class="text-sm font-bold mb-1 block">Role Pengguna <span class="text-red-500">*</span></label>
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
            
            <div class="space-y-4 pt-2 border-t border-surface-100">
                <p class="text-xs text-surface-500 italic mb-3">
                    {{ isEditMode ? 'Isi hanya jika Anda ingin mengganti password.' : 'Password wajib diisi untuk pengguna baru.' }}
                </p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="field">
                        <label class="text-sm font-bold mb-1 block">
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
                        <label class="text-sm font-bold mb-1 block">Konfirmasi Password</label>
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
            <div class="flex justify-end gap-2 pt-4 border-t border-surface-100 mt-2">
                <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="closeDialog" />
                <Button :label="isEditMode ? 'Simpan Perubahan' : 'Buat Pengguna'" icon="pi pi-check" :loading="loading" @click="handleSave" />
            </div>
        </template>
    </Dialog>
</template>