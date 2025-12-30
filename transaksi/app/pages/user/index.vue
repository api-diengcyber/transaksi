<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

definePageMeta({ layout: 'default' });

// --- MOCK SERVICE (Ganti dengan import composable asli Anda) ---
const userService = useUserService(); 
const toast = useToast();
const confirm = useConfirm();

// --- STATE ---
const allUsers = ref([]);
const rolesList = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });
const activeRole = ref('ALL'); 

// Modal State
const showUserModal = ref(false);
const selectedUser = ref(null);

// --- COMPUTED ---

// 1. Menghitung Tab Role secara Dinamis
const roleTabs = computed(() => {
    // Definisi urutan prioritas role agar tampilan rapi
    const priorityRoles = ['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'PRODUCTION', 'RESTAURANT', 'OUTLET'];
    
    // Ambil semua role unik yang ada di database saat ini
    const existingRoles = [...new Set(allUsers.value.flatMap(u => (u.roles || []).map(r => r.role)))];
    
    // Gabungkan prioritas dengan role yang ada (hindari duplikat)
    const combinedRoles = ['ALL', ...new Set([...priorityRoles, ...existingRoles])];

    // Filter: hanya tampilkan role yang benar-benar ada datanya (kecuali ALL)
    return combinedRoles
        .filter(role => role === 'ALL' || existingRoles.includes(role))
        .map(role => {
            let label = role;
            // Mapping nama cantik
            const labelMap = {
                ALL: 'Semua', ADMIN: 'Admin', CASHIER: 'Kasir',
                WAREHOUSE: 'Gudang', PRODUCTION: 'Produksi', 
                RESTAURANT: 'Resto', OUTLET: 'Outlet', MANAGER: 'Manager'
            };
            
            // Hitung jumlah user per role
            const count = role === 'ALL' 
                ? allUsers.value.length 
                : allUsers.value.filter(u => u.roles?.some(r => r.role === role)).length;

            return { 
                role, 
                label: labelMap[role] || role, 
                count 
            };
        });
});

// 2. Filter User Berdasarkan Tab & Pencarian
const filteredUsers = computed(() => {
    let result = allUsers.value;

    // Filter by Tab
    if (activeRole.value !== 'ALL') {
        result = result.filter(user => user.roles?.some(r => r.role === activeRole.value));
    }

    // Filter by Search
    if (filters.value.global.value) {
        const keyword = filters.value.global.value.toLowerCase();
        result = result.filter(user => 
            user.username.toLowerCase().includes(keyword) || 
            (user.email && user.email.toLowerCase().includes(keyword))
        );
    }
    
    return result;
});

// --- METHODS ---
const fetchUsers = async () => {
    loading.value = true;
    try {
        const usersData = await userService.fetchUsers();
        // const rolesData = await userService.getAllRoles(); // Jika diperlukan untuk dropdown modal
        allUsers.value = usersData || [];
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data pengguna', life: 3000 });
    } finally {
        loading.value = false;
    }
};

const openCreateUser = () => {
    selectedUser.value = null;
    showUserModal.value = true;
};

const openEditUser = (user) => {
    selectedUser.value = { ...user };
    showUserModal.value = true;
};

const onUserSaved = () => {
    showUserModal.value = false;
    fetchUsers(); // Refresh data
    toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data pengguna disimpan', life: 3000 });
};

const confirmDeleteUser = (user) => {
    confirm.require({
        message: `Apakah Anda yakin ingin menghapus user "${user.username}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        rejectClass: 'p-button-text',
        accept: async () => {
            try {
                await userService.deleteUser(user.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Pengguna berhasil dihapus', life: 3000 });
                fetchUsers();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus pengguna', life: 3000 });
            }
        }
    });
};

const getRoleSeverity = (role) => {
    const map = {
        ADMIN: 'danger', MANAGER: 'warning', CASHIER: 'success', 
        OUTLET: 'success', WAREHOUSE: 'info', PRODUCTION: 'info'
    };
    return map[role] || 'secondary';
};

// Reset search saat pindah tab
watch(activeRole, () => {
    filters.value.global.value = null;
});

onMounted(() => {
    fetchUsers();
});
</script>

<template>
    <div class="min-h-screen flex flex-col gap-6">
        <Toast position="bottom-right" />
        <ConfirmDialog />

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">
                    Pengguna & Akses
                </h1>
                <p class="text-gray-500 dark:text-gray-400 mt-1">
                    Kelola daftar pengguna, peran, dan hak akses aplikasi.
                </p>
            </div>
            <div class="flex gap-3">
                <Button 
                    label="Tambah Baru" 
                    icon="pi pi-plus" 
                    severity="primary" 
                    class="!px-4 !py-2.5 !rounded-lg font-semibold shadow-lg shadow-primary/30 transition-all hover:scale-105" 
                    @click="openCreateUser" 
                />
            </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-surface-0 dark:bg-surface-900 p-4 rounded-2xl border border-gray-200 dark:border-surface-700 shadow-sm">
            
            <div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-surface-800 rounded-xl overflow-x-auto max-w-full lg:max-w-3xl no-scrollbar">
                <button 
                    v-for="tab in roleTabs" 
                    :key="tab.role"
                    @click="activeRole = tab.role"
                    class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap outline-none focus:ring-2 focus:ring-primary/50"
                    :class="activeRole === tab.role 
                        ? 'bg-surface-0 dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-surface-700/50'"
                >
                    <span>{{ tab.label }}</span>
                    <span 
                        class="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        :class="activeRole === tab.role 
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                            : 'bg-gray-200 dark:bg-surface-600 text-gray-600 dark:text-gray-300'"
                    >
                        {{ tab.count }}
                    </span>
                </button>
            </div>

            <div class="relative w-full lg:w-72 group">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"></i>
                <InputText 
                    v-model="filters.global.value" 
                    placeholder="Cari nama atau email..." 
                    class="w-full !pl-10 !rounded-xl !border-gray-200 dark:!border-surface-700 dark:!bg-surface-800 dark:text-white focus:!border-primary !transition-all" 
                />
            </div>
        </div>

        <div class="bg-surface-0 dark:bg-surface-900 border border-gray-200 dark:border-surface-700 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
            <DataTable 
                :value="filteredUsers" 
                :loading="loading" 
                paginator 
                :rows="10" 
                dataKey="uuid" 
                tableStyle="min-width: 50rem"
                class="flex-1"
                :pt="{
                    headerRow: { class: 'bg-gray-50 dark:bg-surface-800 text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-surface-700' },
                    bodyRow: { class: 'hover:bg-gray-50 dark:hover:bg-surface-800/50 transition-colors border-b border-gray-100 dark:border-surface-800 last:border-0' }
                }"
            >
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16 text-center">
                        <div class="bg-gray-50 dark:bg-surface-800 p-4 rounded-full mb-4">
                            <i class="pi pi-users text-4xl text-gray-400 dark:text-gray-500"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Data Tidak Ditemukan</h3>
                        <p class="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                            Tidak ada pengguna dengan kriteria pencarian atau filter peran yang dipilih.
                        </p>
                    </div>
                </template>

                <Column field="username" header="Pengguna" sortable style="width: 25%">
                    <template #body="{ data }">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                {{ data.username.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                                <div class="font-bold text-gray-800 dark:text-gray-100 text-sm">{{ data.username }}</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">{{ data.email || 'No Email' }}</div>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Role & Akses" style="width: 30%">
                    <template #body="{ data }">
                        <div class="flex flex-wrap gap-2">
                            <Tag 
                                v-for="role in data.roles" 
                                :key="role.uuid" 
                                :value="role.role" 
                                :severity="getRoleSeverity(role.role)"
                                class="!rounded-md !px-2 !py-1 !text-[11px] !font-bold uppercase tracking-wide" 
                            />
                            <span v-if="!data.roles?.length" class="text-xs text-gray-400 italic">No Access</span>
                        </div>
                    </template>
                </Column>

                <Column header="Status" style="width: 15%">
                     <template #body="{ data }">
                        <div 
                            class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                            :class="!data.deletedAt 
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' 
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full mr-2" :class="!data.deletedAt ? 'bg-green-500' : 'bg-red-500'"></span>
                            {{ !data.deletedAt ? 'Aktif' : 'Nonaktif' }}
                        </div>
                    </template>
                </Column>

                <Column header="" style="width: 15%" alignFrozen="right">
                    <template #body="{ data }">
                        <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button 
                                icon="pi pi-pencil" 
                                text 
                                rounded 
                                severity="info" 
                                class="!w-8 !h-8 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                v-tooltip.top="'Edit'"
                                @click="openEditUser(data)" 
                            />
                            <Button 
                                icon="pi pi-trash" 
                                text 
                                rounded 
                                severity="danger" 
                                class="!w-8 !h-8 hover:bg-red-50 dark:hover:bg-red-900/30"
                                v-tooltip.top="'Hapus'"
                                @click="confirmDeleteUser(data)" 
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <UserCreateEditModal 
            v-model:visible="showUserModal" 
            :userData="selectedUser" 
            @saved="onUserSaved" 
        />
    </div>
</template>

<style scoped>
/* Utility untuk menyembunyikan scrollbar pada tab namun tetap bisa discroll */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

</style>