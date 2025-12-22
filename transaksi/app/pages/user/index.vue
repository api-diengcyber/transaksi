<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

definePageMeta({ layout: 'default' });

// Anggap Anda akan membuat composable baru: useUserService()
const userService = useUserService();
const toast = useToast();
const confirm = useConfirm();

const allUsers = ref([]);
const roles = ref([]); 
const loading = ref(true);
const filters = ref({ global: { value: null, matchMode: 'contains' } });

const showUserModal = ref(false);
const selectedUser = ref(null);

// [BARU] State untuk Tab Aktif (Default ke 'ALL' atau 'ADMIN')
const activeRole = ref('ALL'); 

// --- COMPUTED ROLES & LISTS ---

// Daftar Role yang Relevan (diurutkan: ADMIN, MANAGER, sisanya)
const roleTabs = computed(() => {
    const defaultRoles = ['ALL', 'ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'PRODUCTION', 'RESTAURANT', 'OUTLET'];
    
    // Gabungkan dengan role yang benar-benar ada di data, untuk menghindari tab kosong
    const uniqueRolesInUse = [...new Set(allUsers.value.flatMap(u => (u.roles || []).map(r => r.role)))];
    
    const finalTabs = defaultRoles.filter(role => role === 'ALL' || uniqueRolesInUse.includes(role)).map(role => {
        let label = role;
        if (role === 'ALL') label = 'Semua Pengguna';
        else if (role === 'ADMIN') label = 'Administrator';
        else if (role === 'CASHIER') label = 'Kasir';
        else if (role === 'WAREHOUSE') label = 'Gudang';
        else if (role === 'PRODUCTION') label = 'Produksi';
        else if (role === 'RESTAURANT') label = 'Restoran';
        else if (role === 'OUTLET') label = 'Outlet';

        return { label, role };
    });
    
    return finalTabs;
});

// Daftar Pengguna yang Difilter berdasarkan Tab Aktif
const filteredUsers = computed(() => {
    if (activeRole.value === 'ALL') {
        return allUsers.value.filter(user => 
            filters.value.global.value 
            ? JSON.stringify(user).toLowerCase().includes(filters.value.global.value.toLowerCase())
            : true
        );
    }
    
    return allUsers.value.filter(user => {
        // Cek apakah user memiliki role yang sesuai dengan tab aktif
        const hasRole = user.roles.some(r => r.role === activeRole.value);
        
        if (!filters.value.global.value) return hasRole;

        // Filter berdasarkan pencarian jika ada
        const searchMatch = JSON.stringify(user).toLowerCase().includes(filters.value.global.value.toLowerCase());
        return hasRole && searchMatch;
    });
});

// --- FETCH DATA ---
const fetchUsers = async () => {
    loading.value = true;
    try {
        const usersData = await userService.getAllUsers(); // Asumsi endpoint '/user/find-all'
        const rolesData = await userService.getAllRoles(); // Asumsi endpoint '/user/roles'
        
        allUsers.value = usersData || [];
        roles.value = rolesData || [];
    } catch (e) {
        console.error(e);
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data pengguna', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- HANDLERS ---
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
    fetchUsers();
};

const confirmDeleteUser = (user) => {
    confirm.require({
        message: `Hapus pengguna "${user.username}"?`,
        header: 'Konfirmasi Hapus',
        icon: 'pi pi-user-minus',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await userService.deleteUser(user.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Pengguna dihapus', life: 3000 });
                fetchUsers();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus pengguna', life: 3000 });
            }
        }
    });
};

onMounted(() => {
    fetchUsers();
});

// [BARU] Watcher untuk reset filter global saat tab berubah
watch(activeRole, () => {
    filters.value.global.value = null;
});

// [BARU] Helper untuk mendapatkan severity Tag berdasarkan Role
const getRoleSeverity = (role) => {
    if (role === 'ADMIN') return 'danger';
    if (role === 'MANAGER') return 'warning';
    if (role === 'CASHIER' || role === 'OUTLET') return 'success';
    if (role === 'WAREHOUSE' || role === 'PRODUCTION') return 'info';
    return 'secondary';
}
</script>

<template>
    <div class="h-full flex flex-col">
        <Toast />
        <ConfirmDialog />

        <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-black text-surface-900 dark:text-surface-0 tracking-tight">Manajemen Pengguna</h1>
            <Button 
                label="Tambah Pengguna" 
                icon="pi pi-user-plus" 
                severity="primary" 
                @click="openCreateUser" 
                raised 
                rounded 
            />
        </div>

        <div class="flex flex-col lg:flex-row gap-4 mb-4">
            <div class="relative w-full lg:w-96">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500"></i>
                <InputText v-model="filters.global.value" :placeholder="`Cari di ${roleTabs.find(t => t.role === activeRole)?.label}...`" class="w-full pl-10 !rounded-full shadow-sm" />
            </div>
            <div class="flex flex-wrap lg:flex-nowrap gap-1 p-1 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-400 overflow-x-auto">
                <button 
                    v-for="tab in roleTabs" 
                    :key="tab.role"
                    @click="activeRole = tab.role"
                    class="px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                    :class="activeRole === tab.role 
                        ? 'bg-primary-600 text-white shadow-md' 
                        : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'"
                >
                    {{ tab.label }} ({{ (tab.role === 'ALL' ? allUsers : allUsers.filter(u => u.roles.some(r => r.role === tab.role))).length }})
                </button>
            </div>
        </div>

        <div class="card bg-surface-0 dark:bg-surface-400 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden flex-1">
             
            <DataTable :value="filteredUsers" :loading="loading" paginator :rows="10" dataKey="uuid" stripedRows class="text-sm">
                
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-12 text-surface-400 dark:text-surface-600">
                        <i class="pi pi-users text-5xl mb-3 opacity-30"></i>
                        <p>Tidak ada pengguna terdaftar untuk role **{{ roleTabs.find(t => t.role === activeRole)?.label }}**.</p>
                    </div>
                </template>

                <Column field="username" header="Username" sortable style="width: 20%">
                    <template #body="slotProps">
                        <div class="font-bold text-surface-800 dark:text-surface-100">{{ slotProps.data.username }}</div>
                        <div class="text-xs text-surface-500">{{ slotProps.data.email || '-' }}</div>
                    </template>
                </Column>

                <Column header="Role" style="width: 25%">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-1">
                            <Tag v-for="role in slotProps.data.roles" 
                                :key="role.uuid" 
                                :value="role.role" 
                                :severity="getRoleSeverity(role.role)" 
                                rounded
                                class="!text-[10px] uppercase font-bold" 
                            />
                        </div>
                    </template>
                </Column>

                <Column header="Status Akun" style="width: 15%">
                     <template #body="slotProps">
                        <Tag :value="slotProps.data.deletedAt ? 'Nonaktif' : 'Aktif'" 
                            :severity="slotProps.data.deletedAt ? 'danger' : 'success'" 
                            rounded
                            class="!text-[10px] uppercase font-bold" 
                        />
                    </template>
                </Column>

                 <Column field="createdAt" header="Terdaftar Sejak" sortable style="width: 20%">
                    <template #body="slotProps">
                         {{ new Date(slotProps.data.createdAt).toLocaleDateString('id-ID') }}
                    </template>
                </Column>

                <Column header="" style="width: 20%" class="text-right">
                    <template #body="slotProps">
                        <Button label="Edit" icon="pi pi-pencil" severity="info" text @click="openEditUser(slotProps.data)" />
                        <Button label="Hapus" icon="pi pi-trash" severity="danger" text @click="confirmDeleteUser(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <UserCreateEditModal 
            v-model:visible="showUserModal" 
            :userData="selectedUser" 
            :roles="roles"
            @saved="onUserSaved" 
        />
    </div>
</template>