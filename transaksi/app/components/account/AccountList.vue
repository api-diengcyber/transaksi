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
  category: string; // Dinamis (string), bukan enum hardcoded lagi
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
  children?: Account[]; 
  [key: string]: any; 
}

// Gunakan Record<string, Account[]> agar bisa menampung key kategori apapun secara dinamis
type AccountMap = Record<string, Account[]>;

// --- LOGIC ---
const { getAll, remove, update, getCategories } = useAccountService();

const rawAccounts = ref<Account[]>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const selectedAccount = ref<Account | null>(null);
const searchQuery = ref('');

// State untuk menyimpan daftar kategori dari API
const categories = ref<any[]>([]);

// Inisialisasi awal
const groupedAccounts = ref<AccountMap>({});

// 1. Fetch Categories terlebih dahulu
const fetchCategories = async () => {
  try {
    const res: any = await getCategories();
    categories.value = res || [];
    
    // Inisialisasi container untuk setiap kategori yang didapat dari API
    const groups: AccountMap = {};
    categories.value.forEach((cat: any) => {
      groups[cat.value] = [];
    });
    groupedAccounts.value = groups;
  } catch (error) {
    console.error('Gagal mengambil kategori', error);
    // Fallback static jika API gagal
    categories.value = [
      { value: 'ASSET', label: 'Harta (ASSET)' },
      { value: 'LIABILITY', label: 'Kewajiban (LIABILITY)' },
      { value: 'EQUITY', label: 'Modal (EQUITY)' },
      { value: 'REVENUE', label: 'Pendapatan (REVENUE)' },
      { value: 'EXPENSE', label: 'Beban (EXPENSE)' }
    ];
    // Re-init groups fallback
    const groups: AccountMap = {};
    categories.value.forEach((cat: any) => groups[cat.value] = []);
    groupedAccounts.value = groups;
  }
};

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const res: any = await getAll();
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
  // Reset groups: Pastikan setiap key kategori ada isinya array kosong
  const newGroups: AccountMap = {};
  
  if (categories.value.length > 0) {
      categories.value.forEach((cat: any) => {
        newGroups[cat.value] = [];
      });
  } else {
     // Fallback reset keys standar jika categories belum terload
     ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'].forEach(k => newGroups[k] = []);
  }
  
  groupedAccounts.value = newGroups;
  
  const filtered = rawAccounts.value.filter(acc => 
    (acc.name?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) || 
    (acc.code?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())
  );

  const treeRoots = buildTree(filtered);

  // --- PERBAIKAN LOGIC PUSH (TS Safe) ---
  treeRoots.forEach(acc => {
    const category = acc.category;
    if (!category) return;

    // 1. Cek apakah array untuk kategori ini ada di groupedAccounts
    if (!groupedAccounts.value[category]) {
      // Jika belum ada (misal kategori baru yg tdk ada di list categories), inisialisasi
      groupedAccounts.value[category] = [];
    }

    // 2. Gunakan non-null assertion (!) karena kita sudah pastikan array-nya ada di langkah sebelumnya
    groupedAccounts.value[category]!.push(acc);
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

onMounted(async () => {
  await fetchCategories();
  await fetchAccounts();
});
</script>

<template>
  <div class="h-full flex flex-col relative">
    
    <div class="sticky top-0 z-30 -mx-4 px-4 pb-4 pt-2 backdrop-blur-md border-b border-gray-200/50 mb-6 transition-all duration-300">
      <div class="bg-surface-0 p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 class="text-xl font-bold flex items-center gap-2">
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
              class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-surface-0 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all outline-none"
            >
            <span class="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
              <i class="pi pi-search"></i>
            </span>
          </div>
          <button
            @click="openCreateModal"
            class="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-800 active:scale-95 text-white text-sm font-semibold rounded-xl transition-all"
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
        <div class="bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl text-white flex justify-between items-center relative overflow-hidden group">
          <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <i class="pi pi-wallet text-[100px]"></i>
          </div>
          <div class="flex items-center gap-4 relative z-10">
            <div class="bg-surface-0/20 p-3 rounded-xl backdrop-blur-sm">
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
          :list="groupedAccounts['ASSET'] || []"
          group-name="ASSET"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="BEBAN / EXPENSES (5-xxxx)" 
          color="red" 
          icon="pi-shopping-bag"
          :list="groupedAccounts['EXPENSE'] || []"
          group-name="EXPENSE"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />
      </div>

      <div class="flex flex-col gap-6">
        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl text-white flex justify-between items-center relative overflow-hidden">
          <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <i class="pi pi-money-bill text-[100px]"></i>
          </div>
          <div class="flex items-center gap-4 relative z-10">
            <div class="bg-surface-0/20 p-3 rounded-xl backdrop-blur-sm">
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
          :list="groupedAccounts['LIABILITY'] || []"
          group-name="LIABILITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="MODAL / EQUITY (3-xxxx)" 
          color="purple" 
          icon="pi-building"
          :list="groupedAccounts['EQUITY'] || []"
          group-name="EQUITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @move="onMoveAccount"
        />

        <AccountGroup 
          title="PENDAPATAN / REVENUE (4-xxxx)" 
          color="emerald" 
          icon="pi-dollar"
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