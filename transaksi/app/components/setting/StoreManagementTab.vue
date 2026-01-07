<script setup>
import { ref, onMounted, isRef, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '~/stores/auth.store';
import { useStoreService } from '~/composables/useStoreService';

const props = defineProps({
    settings: Object 
});

const authStore = useAuthStore();
const storeService = useStoreService();
const toast = useToast();

const branchTreeNodes = ref([]);
const branchLoading = ref(false);
const createLoading = ref(false);
const isCreateStoreModalOpen = ref(false);
const isBranchModalOpen = ref(false);
const selectedParentBranch = ref(null);

// Forms
const formStore = ref({ name: "", address: "", phone: "", email: "" });
const formBranch = ref({ parentStoreUuid: null, name: "", address: "", phone: "", username: "", email: "", password: "" });

// [LOGIC BARU] Computed Property untuk mengurutkan toko
// Urutan: PUSAT dulu -> lalu CABANG (A-Z / 1-9)
const sortedStores = computed(() => {
    if (!authStore.flatStores) return [];
    
    // Copy array agar tidak memutasi state asli
    const stores = [...authStore.flatStores];

    return stores.sort((a, b) => {
        // Cek status cabang/pusat
        const isBranchA = a.storeType === 'CABANG' || !!a.parentId;
        const isBranchB = b.storeType === 'CABANG' || !!b.parentId;

        // 1. Prioritas Utama: PUSAT (Top) vs CABANG (Bottom)
        if (isBranchA !== isBranchB) {
            return isBranchA ? 1 : -1; // Jika A cabang (true), dia belakangan (return 1)
        }

        // 2. Prioritas Kedua: Nama (Ascending, support angka "Cabang 1, Cabang 2")
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
});

// Helpers
const mapToTreeNodes = (branches) => {
    if (!branches || !Array.isArray(branches)) return [];
    return branches.map((branch) => ({
        key: branch.uuid,
        data: {
            uuid: branch.uuid,
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
            type: "Cabang",
        },
        children: branch.branches && branch.branches.length > 0 ? mapToTreeNodes(branch.branches) : [],
    }));
};

// Fetch Data
const fetchBranches = async () => {
    try {
        const data = await storeService.getBranches();
        const rawData = isRef(data) ? data.value : data || [];
        branchTreeNodes.value = mapToTreeNodes(rawData);
    } catch (e) {
        console.error("Gagal ambil data cabang", e);
    }
};

// Actions
const handleCreateStore = async () => {
    if (!formStore.value.name || !formStore.value.address) {
        toast.add({ severity: "warn", summary: "Validasi", detail: "Nama dan Alamat wajib diisi", life: 3000 });
        return;
    }
    createLoading.value = true;
    try {
        await storeService.createStore(formStore.value);
        toast.add({ severity: "success", summary: "Sukses", detail: "Toko baru berhasil dibuat!", life: 3000 });
        await authStore.fetchUserStores();
        isCreateStoreModalOpen.value = false;
        formStore.value = { name: "", address: "", phone: "", email: "" };
    } catch (error) {
        toast.add({ severity: "error", summary: "Error", detail: "Gagal membuat toko.", life: 3000 });
    } finally {
        createLoading.value = false;
    }
};

const openBranchModal = (parentNode = null) => {
    formBranch.value = { parentStoreUuid: null, name: "", address: "", phone: "", username: "", email: "", password: "" };
    if (parentNode) {
        selectedParentBranch.value = parentNode.data;
        formBranch.value.parentStoreUuid = parentNode.data.uuid;
    } else {
        selectedParentBranch.value = null;
    }
    isBranchModalOpen.value = true;
};

const handleCreateBranch = async () => {
    if (!formBranch.value.name || !formBranch.value.address || !formBranch.value.username || !formBranch.value.password) {
        toast.add({ severity: "warn", summary: "Validasi", detail: "Mohon lengkapi data toko dan data admin.", life: 3000 });
        return;
    }
    branchLoading.value = true;
    try {
        await storeService.createBranch(formBranch.value);
        toast.add({ severity: "success", summary: "Sukses", detail: "Cabang berhasil dibuat!", life: 3000 });
        isBranchModalOpen.value = false;
        await fetchBranches();
    } catch (error) {
        const msg = error.response?._data?.message || "Gagal membuat cabang.";
        toast.add({ severity: "error", summary: "Error", detail: msg, life: 3000 });
    } finally {
        branchLoading.value = false;
    }
};

onMounted(() => {
    fetchBranches();
});

// Helper visual untuk membedakan Pusat vs Cabang
const getStoreTypeConfig = (store) => {
    const isBranch = !!store.parentId || store.storeType === 'CABANG';
    
    return isBranch ? {
        type: 'CABANG',
        label: 'CABANG',
        icon: 'pi pi-sitemap',
        colorClass: 'text-orange-600 bg-orange-50 border-l-4 border-l-orange-500',
        badgeSeverity: 'warning',
        desc: store.description || 'Cabang Toko'
    } : {
        type: 'PUSAT',
        label: 'PUSAT',
        icon: 'pi pi-building',
        colorClass: 'text-primary-600 bg-surface-0 border-l-4 border-l-primary-600',
        badgeSeverity: 'info',
        desc: store.description || 'Pusat Operasional'
    };
};
</script>

<template>
    <div class="animate-fade-in space-y-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-0 p-5 rounded-xl border border-surface-200  shadow-sm gap-4">
            <div>
                <h3 class="text-lg font-bold text-surface-900  flex items-center gap-2">
                    <i class="pi pi-briefcase text-primary-600"></i>
                    Manajemen Toko & Cabang
                </h3>
                <p class="text-sm text-surface-500  mt-1">
                    Kelola toko utama dan struktur hierarki cabang usaha Anda.
                </p>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                <Button label="Buat Toko Baru" icon="pi pi-plus" severity="secondary" outlined class="flex-1 md:flex-none" @click="isCreateStoreModalOpen = true" />
                <Button label="Tambah Cabang" icon="pi pi-sitemap" class="flex-1 md:flex-none" @click="openBranchModal(null)" />
            </div>
        </div>

        <div>
            <h4 class="text-sm font-bold text-surface-500 uppercase tracking-wider mb-4 px-1">
                Daftar Akses Toko ({{ sortedStores.length }})
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="store in sortedStores" :key="store.uuid" 
                    @click="authStore.switchStore(store.uuid)"
                    class="group relative rounded-xl border transition-all cursor-pointer shadow-sm hover:shadow-md overflow-hidden bg-surface-0"
                    :class="[
                        getStoreTypeConfig(store).colorClass,
                        store.uuid === authStore.activeStore?.uuid 
                            ? 'ring-2 ring-offset-2 ring-primary-500 border-transparent' 
                            : 'border-surface-200  hover:border-primary-300'
                    ]"
                >
                    <div v-if="store.uuid === authStore.activeStore?.uuid" 
                         class="absolute top-0 right-0 bg-primary-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">
                        SEDANG AKTIF
                    </div>

                    <div class="p-5">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
                                 :class="store.parentId ? 'bg-orange-100 text-orange-600' : 'bg-primary-50 text-primary-600'">
                                <i :class="[getStoreTypeConfig(store).icon, 'text-xl']"></i>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <Tag :value="getStoreTypeConfig(store).label" 
                                         :severity="getStoreTypeConfig(store).badgeSeverity" 
                                         class="!text-[10px] !px-1.5 !py-0 font-bold" />
                                    <span v-if="store.uuid === authStore.activeStore?.uuid" class="flex h-2 w-2 relative">
                                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                </div>
                                
                                <h4 class="font-bold text-lg text-surface-900 truncate leading-tight mb-1">
                                    {{ store.name }}
                                </h4>
                                
                                <p class="text-xs font-medium text-surface-500  flex items-center gap-1">
                                    <i class="pi pi-info-circle text-[10px]"></i>
                                    {{ getStoreTypeConfig(store).desc }}
                                </p>
                            </div>
                        </div>

                        <hr class="my-4 border-dashed border-surface-200 " />

                        <div class="space-y-2">
                            <div class="flex items-start gap-2 text-sm ">
                                <i class="pi pi-map-marker mt-0.5 text-surface-400"></i>
                                <span class="line-clamp-2 text-xs leading-relaxed">
                                    {{ store.address || "Belum ada alamat" }}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 text-sm ">
                                <i class="pi pi-phone text-surface-400"></i>
                                <span class="text-xs">{{ store.phone || "-" }}</span>
                            </div>
                        </div>

                        <div v-if="store.branches && store.branches.length > 0" class="mt-4 pt-3 border-t border-dashed border-surface-200 ">
                            <span class="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                <i class="pi pi-sitemap text-[10px]"></i>
                                Memiliki {{ store.branches.length }} Cabang:
                            </span>
                            <div class="flex flex-wrap gap-2">
                                <span v-for="branch in store.branches" :key="branch.uuid" 
                                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700  text-xs font-medium border border-orange-100  shadow-sm">
                                    <i class="pi pi-building text-[9px] opacity-70"></i>
                                    {{ branch.name }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-surface-50 px-5 py-3 flex justify-between items-center text-xs font-medium text-surface-500 transition-colors group-hover:bg-primary-50">
                        <span>ID: {{ store.uuid.substring(0, 8) }}...</span>
                        <span class="text-primary-600 group-hover:underline flex items-center gap-1">
                            Kelola Toko Ini <i class="pi pi-arrow-right"></i>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-8 pt-8 border-t border-surface-0 ">
            <h4 class="text-sm font-bold text-surface-500 uppercase tracking-wider mb-4 flex items-center gap-2 px-1">
                <i class="pi pi-sitemap"></i> Struktur Hierarki Cabang: <span class="text-primary-600">{{ authStore.activeStore?.name }}</span>
            </h4>

            <div v-if="branchTreeNodes.length === 0" class="flex flex-col items-center justify-center py-12 bg-surface-0 rounded-xl border border-dashed border-surface-300">
                <div class="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-3">
                    <i class="pi pi-sitemap text-2xl text-surface-400"></i>
                </div>
                <p class=" font-medium mb-1">Belum ada struktur cabang</p>
                <p class="text-surface-500 text-xs mb-4">Toko ini belum memiliki cabang di bawahnya.</p>
                <Button label="Buat Cabang Pertama" icon="pi pi-plus" size="small" @click="openBranchModal(null)" />
            </div>

            <div v-else class="card border border-surface-200  rounded-xl overflow-hidden bg-surface-0 shadow-sm">
                <TreeTable :value="branchTreeNodes" :autoLayout="true" class="text-sm">
                    <Column field="name" header="Nama Cabang" :expander="true">
                        <template #body="slotProps">
                            <span class="font-bold ">{{ slotProps.node.data.name }}</span>
                        </template>
                    </Column>
                    <Column field="address" header="Alamat" style="min-width: 200px">
                        <template #body="slotProps">
                            <span class="text-xs text-surface-500">{{ slotProps.node.data.address || '-' }}</span>
                        </template>
                    </Column>
                    <Column field="phone" header="Telepon"></Column>
                    <Column header="Aksi" style="width: 100px; text-align: right">
                        <template #body="slotProps">
                            <Button icon="pi pi-plus" size="small" text rounded severity="secondary" v-tooltip.top="'Tambah Sub-Cabang'" @click="openBranchModal(slotProps.node)" />
                        </template>
                    </Column>
                </TreeTable>
            </div>
        </div>

        <Dialog v-model:visible="isCreateStoreModalOpen" modal header="Buat Toko Baru" :style="{ width: '600px' }" :draggable="false" class="p-fluid">
             <div class="flex flex-col gap-6 pt-2">
                 <div class="bg-blue-50 p-4 rounded-lg flex items-start gap-3 border border-blue-100 ">
                    <i class="pi pi-building text-blue-600 text-xl mt-0.5"></i>
                    <div class="text-sm ">
                        <span class="font-bold text-blue-700  block mb-1">Pusat Operasional Baru</span>
                        <span>Anda akan membuat entitas toko baru yang berdiri sendiri (bukan cabang). Toko ini akan memiliki stok, laporan, dan manajemen terpisah.</span>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="text-xs font-bold text-primary-600 uppercase tracking-wider border-b pb-1">Informasi Toko</div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div class="md:col-span-2">
                            <label class="font-semibold text-sm mb-1 block">Nama Toko <span class="text-red-500">*</span></label>
                            <InputText v-model="formStore.name" class="w-full" placeholder="Contoh: Toko Pusat Jakarta" autofocus />
                         </div>
                         <div class="md:col-span-2">
                            <label class="font-semibold text-sm mb-1 block">Alamat Lengkap <span class="text-red-500">*</span></label>
                            <Textarea v-model="formStore.address" rows="3" class="w-full" placeholder="Jl. Sudirman No. 1..." />
                         </div>
                         
                         <div>
                            <label class="font-semibold text-sm mb-1 block">No. Telepon</label>
                            <InputText v-model="formStore.phone" class="w-full" placeholder="0812..." />
                         </div>
                         <div>
                            <label class="font-semibold text-sm mb-1 block">Email Toko</label>
                            <InputText v-model="formStore.email" class="w-full" placeholder="admin@toko.com" />
                         </div>
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Batal" icon="pi pi-times" text @click="isCreateStoreModalOpen = false" severity="secondary" />
                <Button label="Simpan Toko" icon="pi pi-check" @click="handleCreateStore" :loading="createLoading" severity="primary" />
            </template>
        </Dialog>

        <Dialog v-model:visible="isBranchModalOpen" modal :header="selectedParentBranch ? 'Tambah Sub-Cabang' : 'Tambah Cabang Utama'" :style="{ width: '600px' }" :draggable="false">
            <div class="flex flex-col gap-6 pt-2">
                 <div class="bg-orange-50 p-4 rounded-lg flex items-start gap-3 border border-orange-100 ">
                    <i class="pi pi-sitemap text-orange-600 text-xl mt-0.5"></i>
                    <div class="text-sm ">
                        <span v-if="selectedParentBranch">
                            Cabang baru ini akan menjadi bawahan dari <strong>{{ selectedParentBranch.name }}</strong>.
                        </span>
                        <span v-else>
                            Cabang ini akan berada langsung di bawah toko utama (<strong>{{ authStore.activeStore?.name }}</strong>).
                        </span>
                        <div class="mt-1 text-xs opacity-70">Cabang akan mewarisi beberapa pengaturan dari induknya.</div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="text-xs font-bold text-primary-600 uppercase tracking-wider border-b pb-1">Informasi Cabang</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div class="md:col-span-2">
                            <label class="font-semibold text-sm mb-1 block">Nama Cabang <span class="text-red-500">*</span></label>
                            <InputText v-model="formBranch.name" class="w-full" placeholder="Contoh: Cabang Surabaya Barat" />
                         </div>
                         <div class="md:col-span-2">
                            <label class="font-semibold text-sm mb-1 block">Alamat <span class="text-red-500">*</span></label>
                            <Textarea v-model="formBranch.address" rows="2" class="w-full" />
                         </div>
                         <div><label class="font-semibold text-sm mb-1 block">Telepon</label><InputText v-model="formBranch.phone" class="w-full" /></div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="text-xs font-bold text-primary-600 uppercase tracking-wider border-b pb-1">Admin Cabang (Login)</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="font-semibold text-sm mb-1 block">Username <span class="text-red-500">*</span></label><InputText v-model="formBranch.username" class="w-full" placeholder="user_cabang" /></div>
                        <div><label class="font-semibold text-sm mb-1 block">Email <span class="text-red-500">*</span></label><InputText v-model="formBranch.email" class="w-full" placeholder="email@cabang.com" /></div>
                        <div class="md:col-span-2"><label class="font-semibold text-sm mb-1 block">Password <span class="text-red-500">*</span></label><Password v-model="formBranch.password" :feedback="false" toggleMask class="w-full" inputClass="w-full" /></div>
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Batal" icon="pi pi-times" text @click="isBranchModalOpen = false" severity="secondary" />
                <Button label="Buat Cabang" icon="pi pi-check" @click="handleCreateBranch" :loading="branchLoading" severity="primary" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.4s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>