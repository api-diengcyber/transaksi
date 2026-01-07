<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import AccountCreateEditModal from './AccountCreateEditModal.vue';
import AccountGroup from './AccountGroup.vue'; 

// --- DEFINISI TIPE ---
export interface Account {
  uuid: string;
  parentUuid: string | null;
  code: string;
  name: string;
  category: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
  children?: Account[]; 
  [key: string]: any; 
}

type AccountMap = Record<string, Account[]>;

// --- COMPOSABLES ---
const { getAll, remove, update, getCategories } = useAccountService();

// --- STATE ---
const rawAccounts = ref<Account[]>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const selectedAccount = ref<Account | null>(null);
const searchQuery = ref('');
const categories = ref<any[]>([]);
const groupedAccounts = ref<AccountMap>({});

// --- FETCH DATA ---
const fetchCategories = async () => {
  try {
    const res: any = await getCategories();
    categories.value = res || [];
    initializeGroups();
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Fallback categories jika API gagal
    categories.value = [
      { value: 'ASSET', label: 'Harta (ASSET)' },
      { value: 'LIABILITY', label: 'Kewajiban (LIABILITY)' },
      { value: 'EQUITY', label: 'Modal (EQUITY)' },
      { value: 'REVENUE', label: 'Pendapatan (REVENUE)' },
      { value: 'EXPENSE', label: 'Beban (EXPENSE)' }
    ];
    initializeGroups();
  }
};

const initializeGroups = () => {
  const groups: AccountMap = {};
  categories.value.forEach((cat: any) => {
    groups[cat.value] = [];
  });
  groupedAccounts.value = groups;
};

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const res: any = await getAll();
    rawAccounts.value = Array.isArray(res) ? res : [];
    distributeAccounts();
  } catch (error) {
    console.error('Error fetching accounts:', error);
    rawAccounts.value = [];
  } finally {
    loading.value = false;
  }
};

// --- LOGIC TREE & GROUPING ---
const buildTree = (accounts: Account[]) => {
  const map: Record<string, Account> = {};
  const roots: Account[] = [];

  // 1. Buat Map untuk lookup cepat dan reset children
  accounts.forEach(acc => {
    map[acc.uuid] = { ...acc, children: [] }; 
  });

  // 2. Susun hierarki Parent-Child
  accounts.forEach(acc => {
    const currentAccount = map[acc.uuid];
    if (!currentAccount) return;

    if (acc.parentUuid && map[acc.parentUuid]) {
      map[acc.parentUuid]!.children?.push(currentAccount);
    } else {
      roots.push(currentAccount);
    }
  });

  // 3. Sorting Recursive berdasarkan Kode Akun
  const sortRecursive = (nodes: Account[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortRecursive(node.children);
      }
    });
  };

  sortRecursive(roots);
  return roots;
};

const distributeAccounts = () => {
  // Reset container groups
  initializeGroups();
  
  // Filter pencarian
  const filtered = rawAccounts.value.filter(acc => 
    (acc.name?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) || 
    (acc.code?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())
  );

  // Bangun Tree Structure dari data yang sudah difilter
  const treeRoots = buildTree(filtered);

  // Masukkan Root Nodes ke dalam kategori masing-masing
  treeRoots.forEach(acc => {
    const category = acc.category;
    if (!category) return;

    if (!groupedAccounts.value[category]) {
      groupedAccounts.value[category] = [];
    }
    groupedAccounts.value[category]!.push(acc);
  });
};

watch(searchQuery, () => distributeAccounts());

// --- EVENT HANDLERS ---
const onMoveAccount = async (payload: { item: Account, newParentUuid: string | null, newCategory: string }) => {
  const { item, newParentUuid, newCategory } = payload;
  
  // Optimistic UI check: jika tidak ada perubahan, return
  if (item.parentUuid === newParentUuid && item.category === newCategory) return;

  // Tentukan Normal Balance baru secara otomatis berdasarkan kategori
  let newNormalBalance: 'DEBIT' | 'CREDIT' = item.normalBalance;
  if (item.category !== newCategory) {
     if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(newCategory)) {
      newNormalBalance = 'CREDIT';
    } else {
      newNormalBalance = 'DEBIT';
    }
  }

  try {
    await update(item.uuid, {
      parentUuid: newParentUuid,
      category: newCategory,
      normalBalance: newNormalBalance,
      name: item.name,
      code: item.code
    });
    // Refresh data untuk memastikan konsistensi
    await fetchAccounts();
  } catch (e) {
    console.error(e);
    alert("Gagal memindahkan akun. Silakan coba lagi.");
    await fetchAccounts(); // Revert UI
  }
};

const openCreateModal = () => {
  selectedAccount.value = null;
  isModalOpen.value = true;
};

const editAccount = (account: Account) => {
  selectedAccount.value = account;
  isModalOpen.value = true;
};

const deleteAccount = async (uuid: string) => {
  if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;
  try {
    await remove(uuid);
    fetchAccounts();
  } catch (error: any) {
    alert('Gagal menghapus akun. Pastikan akun tidak memiliki transaksi.');
  }
};

// --- LIFECYCLE ---
onMounted(async () => {
  await fetchCategories();
  await fetchAccounts();
});
</script>

<template>
  <div class="h-full flex flex-col relative bg-surface-0">
    
    <div class="sticky top-0 z-30 px-4 pt-4 pb-2 bg-surface-0 backdrop-blur-md border-b border-gray-200 transition-all">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div>
          <h2 class="text-xl font-bold flex items-center gap-2">
            <div class="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
              <i class="pi pi-sitemap text-lg"></i>
            </div>
            Daftar Akun (COA)
          </h2>
          <p class="text-xs text-gray-500 mt-0.5 ml-10 hidden md:block">
            Kelola struktur akun untuk laporan keuangan.
          </p>
        </div>
        
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64 group">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors"></i>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari kode atau nama..." 
              class="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-200 bg-gray-50 focus:bg-surface-0 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all outline-none"
            >
          </div>
          <button
            @click="openCreateModal"
            class="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            <i class="pi pi-plus mr-1.5"></i>&nbsp;Akun Baru
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex flex-col justify-center items-center min-h-[300px]">
      <i class="pi pi-spin pi-spinner text-3xl text-indigo-500 mb-3"></i>
      <span class="text-gray-400 text-sm font-medium animate-pulse">Memuat Struktur Akun...</span>
    </div>

    <div v-else class="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-24 overflow-y-auto custom-scrollbar">
      
      <div class="flex flex-col gap-5">
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 rounded-xl text-white shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-3">
                 <div class="bg-surface-0 p-1.5 rounded-lg backdrop-blur-sm">
                    <i class="pi pi-wallet text-white text-lg"></i>
                </div>
                <div>
                    <h3 class="font-bold text-sm uppercase tracking-wide">Aktiva & Beban</h3>
                    <p class="text-[10px] text-blue-100 opacity-90">Saldo Normal: DEBIT</p>
                </div>
            </div>
             <i class="pi pi-arrow-up-right text-white/50 text-2xl"></i>
        </div>

        <AccountGroup 
          title="HARTA (ASSETS)" 
          color="blue" 
          icon="pi-briefcase"
          :list="groupedAccounts['ASSET'] || []"
          group-name="ASSET"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="BEBAN (EXPENSES)" 
          color="red" 
          icon="pi-shopping-bag"
          :list="groupedAccounts['EXPENSE'] || []"
          group-name="EXPENSE"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />
      </div>

      <div class="flex flex-col gap-5">
         <div class="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 rounded-xl text-white shadow-sm flex items-center justify-between">
             <div class="flex items-center gap-3">
                 <div class="bg-surface-0 p-1.5 rounded-lg backdrop-blur-sm">
                    <i class="pi pi-building text-white text-lg"></i>
                </div>
                <div>
                    <h3 class="font-bold text-sm uppercase tracking-wide">Pasiva & Pendapatan</h3>
                    <p class="text-[10px] text-emerald-100 opacity-90">Saldo Normal: KREDIT</p>
                </div>
            </div>
            <i class="pi pi-arrow-down-left text-white/50 text-2xl"></i>
        </div>

        <AccountGroup 
          title="KEWAJIBAN (LIABILITIES)" 
          color="orange" 
          icon="pi-exclamation-circle"
          :list="groupedAccounts['LIABILITY'] || []"
          group-name="LIABILITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="MODAL (EQUITY)" 
          color="purple" 
          icon="pi-verified"
          :list="groupedAccounts['EQUITY'] || []"
          group-name="EQUITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="PENDAPATAN (REVENUE)" 
          color="emerald" 
          icon="pi-percentage"
          :list="groupedAccounts['REVENUE'] || []"
          group-name="REVENUE"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />
      </div>
    </div>

    <AccountCreateEditModal
      :is-open="isModalOpen"
      :account-data="selectedAccount"
      :available-accounts="rawAccounts" 
      :categories="categories"
      @close="isModalOpen = false"
      @refresh="fetchAccounts"
    />
  </div>
</template>

<style scoped>
/* Scrollbar halus untuk container grid */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>