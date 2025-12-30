<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import AccountCreateEditModal from './AccountCreateEditModal.vue';
import AccountGroup from './AccountGroup.vue'; 

// --- DEFINISI TIPE ---
export interface Account {
  uuid: string;
  parentUuid: string | null;
  code: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
  children?: Account[]; 
  [key: string]: any; 
}

type AccountMap = {
  [key: string]: Account[];
  ASSET: Account[];
  LIABILITY: Account[];
  EQUITY: Account[];
  REVENUE: Account[];
  EXPENSE: Account[];
}

// --- LOGIC ---
const { getAll, remove, update } = useAccountService();

const rawAccounts = ref<Account[]>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const selectedAccount = ref<Account | null>(null);
const searchQuery = ref('');

const groupedAccounts = ref<AccountMap>({
  ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: []
});

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const res = await getAll();
    rawAccounts.value = Array.isArray(res) ? res : [];
    distributeAccounts();
  } catch (error) {
    console.error('Gagal mengambil data akun', error);
    rawAccounts.value = [];
  } finally {
    loading.value = false;
  }
};

const buildTree = (accounts: Account[]) => {
  const map: Record<string, Account> = {};
  const roots: Account[] = [];

  accounts.forEach(acc => {
    map[acc.uuid] = { ...acc, children: [] }; 
  });

  accounts.forEach(acc => {
    const currentAccount = map[acc.uuid];
    if (!currentAccount) return;

    if (acc.parentUuid && map[acc.parentUuid]) {
      const parentAccount = map[acc.parentUuid];
      if (parentAccount) {
        if (!parentAccount.children) parentAccount.children = [];
        parentAccount.children.push(currentAccount);
      }
    } else {
      roots.push(currentAccount);
    }
  });

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
  groupedAccounts.value = { 
    ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: [] 
  };
  
  const filtered = rawAccounts.value.filter(acc => 
    (acc.name?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) || 
    (acc.code?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())
  );

  const treeRoots = buildTree(filtered);

  treeRoots.forEach(acc => {
    if (acc.category && groupedAccounts.value[acc.category]) {
      groupedAccounts.value[acc.category].push(acc);
    }
  });
};

watch(searchQuery, () => {
  distributeAccounts();
});

const onMoveAccount = async (payload: { item: Account, newParentUuid: string | null, newCategory: string }) => {
  const { item, newParentUuid, newCategory } = payload;
  if (item.parentUuid === newParentUuid && item.category === newCategory) return;

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
    await fetchAccounts();
  } catch (e) {
    alert("Gagal memindahkan akun. Mengembalikan posisi...");
    await fetchAccounts(); 
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
  if (!confirm('Hapus akun ini?')) return;
  try {
    await remove(uuid);
    fetchAccounts();
  } catch (error: any) {
    alert('Gagal menghapus akun.');
  }
};

onMounted(() => {
  fetchAccounts();
});
</script>

<template>
  <div class="h-full flex flex-col relative">
    
    <div class="sticky top-0 z-30 -mx-4 px-4 pb-4 pt-2 bg-gray-50/80 backdrop-blur-md border-b border-gray-200/50 mb-6 transition-all duration-300">
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span class="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
              <i class="pi pi-sitemap text-lg"></i>
            </span>
            Chart of Accounts
          </h2>
          <p class="text-xs text-gray-500 mt-1 ml-11 hidden md:block">Atur struktur akun (COA) dengan drag & drop.</p>
        </div>
        
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-72 group">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari akun..." 
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all outline-none"
            >
            <span class="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
              <i class="pi pi-search"></i>
            </span>
          </div>
          <button
            @click="openCreateModal"
            class="inline-flex items-center px-5 py-2.5 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-gray-200"
          >
            <i class="pi pi-plus mr-2"></i> Baru
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex flex-col justify-center items-center min-h-[400px]">
      <div class="animate-spin rounded-full h-12 w-12 border-[3px] border-indigo-100 border-b-indigo-600 mb-4"></div>
      <span class="text-gray-400 text-sm font-medium animate-pulse">Memuat Struktur Akun...</span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start pb-20">
      
      <div class="flex flex-col gap-6">
        <div class="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl shadow-blue-200 text-white flex justify-between items-center relative overflow-hidden group">
          <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <i class="pi pi-wallet text-[100px]"></i>
          </div>
          <div class="flex items-center gap-4 relative z-10">
            <div class="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <i class="pi pi-arrow-up-right text-white text-xl"></i>
            </div>
            <div>
              <h3 class="font-bold text-lg tracking-wide">ACTIVA & BEBAN</h3>
              <p class="text-xs text-blue-100 opacity-90">Saldo Normal: DEBIT</p>
            </div>
          </div>
        </div>

        <AccountGroup 
          title="HARTA / ASSETS (1-xxxx)" 
          color="blue" 
          icon="pi-wallet"
          :list="groupedAccounts.ASSET"
          group-name="ASSET"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="BEBAN / EXPENSES (5-xxxx)" 
          color="red" 
          icon="pi-shopping-bag"
          :list="groupedAccounts.EXPENSE"
          group-name="EXPENSE"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />
      </div>

      <div class="flex flex-col gap-6">
        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-xl shadow-emerald-200 text-white flex justify-between items-center relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <i class="pi pi-money-bill text-[100px]"></i>
          </div>
          <div class="flex items-center gap-4 relative z-10">
            <div class="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <i class="pi pi-arrow-down-left text-white text-xl"></i>
            </div>
            <div>
              <h3 class="font-bold text-lg tracking-wide">PASIVA & PENDAPATAN</h3>
              <p class="text-xs text-emerald-100 opacity-90">Saldo Normal: KREDIT</p>
            </div>
          </div>
        </div>

        <AccountGroup 
          title="KEWAJIBAN / LIABILITIES (2-xxxx)" 
          color="yellow" 
          icon="pi-exclamation-circle"
          :list="groupedAccounts.LIABILITY"
          group-name="LIABILITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="MODAL / EQUITY (3-xxxx)" 
          color="purple" 
          icon="pi-building"
          :list="groupedAccounts.EQUITY"
          group-name="EQUITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="PENDAPATAN / REVENUE (4-xxxx)" 
          color="emerald" 
          icon="pi-dollar"
          :list="groupedAccounts.REVENUE"
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
      @close="isModalOpen = false"
      @refresh="fetchAccounts"
    />
  </div>
</template>

<style scoped>
/* Custom Scrollbar untuk area draggable jika panjang */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}
</style>