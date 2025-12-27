<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import draggable from 'vuedraggable';
import AccountCreateEditModal from './AccountCreateEditModal.vue';

// --- DEFINISI TIPE ---
export interface Account {
  uuid: string;
  code: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
  [key: string]: any; 
}

// Tipe Map untuk Grouping
type AccountMap = {
  [key: string]: Account[]; // Index signature agar bisa diakses dengan string
  ASSET: Account[];
  LIABILITY: Account[];
  EQUITY: Account[];
  REVENUE: Account[];
  EXPENSE: Account[];
}

// --- INTERNAL COMPONENT: ACCOUNT GROUP CARD ---
const AccountGroup = {
  name: 'AccountGroup',
  components: { draggable },
  props: ['title', 'color', 'list', 'groupName', 'icon'],
  emits: ['edit', 'remove', 'change'],
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full transition-all hover:shadow-md">
      <div :class="\`bg-\${color}-50 border-b border-\${color}-100 p-3 flex justify-between items-center\`">
        <div class="flex items-center gap-2">
          <i :class="\`pi \${icon} text-\${color}-600\`"></i>
          <span :class="\`font-bold text-\${color}-800 text-xs md:text-sm uppercase tracking-wider\`">{{ title }}</span>
        </div>
        <span class="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-gray-500 border border-gray-100 shadow-sm">
          {{ list.length }} Akun
        </span>
      </div>
      
      <div class="p-2 bg-gray-50/30 min-h-[120px] h-full">
        <draggable 
          :list="list" 
          group="accounts" 
          item-key="uuid"
          @change="$emit('change', $event)"
          class="space-y-2 min-h-[100px]"
          ghost-class="sortable-ghost"
          drag-class="sortable-drag"
          animation="200"
        >
          <template #item="{ element }">
            <div class="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 transition-all cursor-move group relative flex items-center justify-between">
              <div class="flex items-center gap-3 overflow-hidden">
                <div :class="\`h-8 w-1 rounded-full bg-\${color}-500 shrink-0\`"></div>
                <div class="truncate">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 rounded border border-gray-200">
                      {{ element.code }}
                    </span>
                    <span v-if="element.isSystem" class="text-[9px] bg-gray-800 text-white px-1.5 rounded-full font-bold">SYS</span>
                  </div>
                  <div class="font-semibold text-gray-800 text-xs md:text-sm mt-0.5 truncate" :title="element.name">
                    {{ element.name }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-white pl-2 shadow-[-10px_0_10px_white]">
                <button @click.stop="$emit('edit', element)" class="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Edit">
                  <i class="pi pi-pencil text-xs"></i>
                </button>
                <button v-if="!element.isSystem" @click.stop="$emit('remove', element.uuid)" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus">
                  <i class="pi pi-trash text-xs"></i>
                </button>
                <div class="p-1.5 text-gray-300 cursor-move">
                  <i class="pi pi-bars text-xs"></i>
                </div>
              </div>
            </div>
          </template>
        </draggable>

        <div v-if="list.length === 0" class="h-full flex flex-col items-center justify-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg m-1 opacity-60">
          <i class="pi pi-inbox text-2xl mb-1"></i>
          <span class="text-xs italic">Kosong</span>
        </div>
      </div>
    </div>
  `
};

// --- LOGIC ---
const { getAll, remove, update } = useAccountService();

const rawAccounts = ref<Account[]>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const selectedAccount = ref<Account | null>(null);
const searchQuery = ref('');

// Gunakan tipe AccountMap agar TS tahu struktur objectnya
const groupedAccounts = ref<AccountMap>({
  ASSET: [] as Account[],
  LIABILITY: [] as Account[],
  EQUITY: [] as Account[],
  REVENUE: [] as Account[],
  EXPENSE: [] as Account[]
});

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const res = await getAll();
    // Validasi res agar selalu array
    rawAccounts.value = Array.isArray(res) ? res : [];
    distributeAccounts();
  } catch (error) {
    console.error('Gagal mengambil data akun', error);
    rawAccounts.value = [];
  } finally {
    loading.value = false;
  }
};

const distributeAccounts = () => {
  // Reset container
  groupedAccounts.value = { 
    ASSET: [], LIABILITY: [], EQUITY: [], REVENUE: [], EXPENSE: [] 
  };
  
  const filtered = rawAccounts.value.filter(acc => 
    (acc.name?.toLowerCase() || '').includes(searchQuery.value.toLowerCase()) || 
    (acc.code?.toLowerCase() || '').includes(searchQuery.value.toLowerCase())
  );

  filtered.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  filtered.forEach(acc => {
    // Type checking: Pastikan category ada di dalam groupedAccounts
    if (acc.category && groupedAccounts.value[acc.category]) {
      groupedAccounts.value[acc.category].push(acc);
    } else {
      console.warn(`Kategori tidak dikenal: ${acc.category} pada akun ${acc.name}`);
    }
  });
};

watch(searchQuery, () => {
  distributeAccounts();
});

const onListChange = async (event: any, newCategory: string) => {
  if (event.added) {
    const movedAccount = event.added.element as Account;
    
    let newNormalBalance: 'DEBIT' | 'CREDIT' = 'DEBIT';
    if (['LIABILITY', 'EQUITY', 'REVENUE'].includes(newCategory)) {
      newNormalBalance = 'CREDIT';
    }
    
    movedAccount.category = newCategory as any;
    movedAccount.normalBalance = newNormalBalance;

    try {
      await update(movedAccount.uuid, {
        category: newCategory,
        normalBalance: newNormalBalance,
        name: movedAccount.name,
        code: movedAccount.code
      });
    } catch (e) {
      alert("Gagal memindahkan akun. Mengembalikan posisi...");
      fetchAccounts(); 
    }
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
  if (!confirm('Hapus akun ini? Transaksi jurnal yang menggunakan akun ini mungkin akan kehilangan referensi.')) return;
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
  <div class="h-full flex flex-col space-y-4 animate-fade-in">
    
    <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-20">
      <div>
        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
          <i class="pi pi-book text-indigo-600 bg-indigo-50 p-2 rounded-lg"></i> 
          Chart of Accounts (COA)
        </h2>
        <p class="text-xs text-gray-500 mt-1 hidden md:block">Atur struktur akun dengan drag & drop. Posisi menentukan laporan.</p>
      </div>
      
      <div class="flex gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:w-64 group">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Cari akun (Nama/Kode)..." 
            class="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all group-hover:border-indigo-300"
          >
          <span class="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
            <i class="pi pi-search"></i>
          </span>
        </div>
        <button
          @click="openCreateModal"
          class="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
        >
          <i class="pi pi-plus mr-2"></i> Baru
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex justify-center items-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-b-indigo-600"></div>
        <span class="text-gray-500 text-sm font-medium">Memuat Data Akun...</span>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-10">
      
      <div class="flex flex-col gap-4">
        <div class="bg-gradient-to-r from-blue-600 to-blue-500 p-3 rounded-xl shadow-lg text-white flex justify-between items-center ring-4 ring-blue-50">
          <div class="flex items-center gap-2">
            <i class="pi pi-arrow-circle-up text-blue-200"></i>
            <div>
              <h3 class="font-bold text-base tracking-wide leading-tight">ACTIVA & BEBAN</h3>
              <p class="text-[10px] text-blue-100 opacity-80">Posisi Kiri (Debit)</p>
            </div>
          </div>
          <span class="text-[10px] font-mono bg-white/20 px-2 py-1 rounded backdrop-blur-sm border border-white/10">Normal: DEBIT</span>
        </div>

        <AccountGroup 
          title="HARTA / ASSETS (1-xxxx)" 
          color="blue" 
          icon="pi-wallet"
          :list="groupedAccounts.ASSET"
          group-name="ASSET"
          @edit="editAccount"
          @remove="deleteAccount"
          @change="onListChange($event, 'ASSET')"
        />

        <AccountGroup 
          title="BEBAN / EXPENSES (5-xxxx)" 
          color="red" 
          icon="pi-shopping-bag"
          :list="groupedAccounts.EXPENSE"
          group-name="EXPENSE"
          @edit="editAccount"
          @remove="deleteAccount"
          @change="onListChange($event, 'EXPENSE')"
        />
      </div>

      <div class="flex flex-col gap-4">
        <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 p-3 rounded-xl shadow-lg text-white flex justify-between items-center ring-4 ring-emerald-50">
          <div class="flex items-center gap-2">
            <i class="pi pi-arrow-circle-down text-emerald-200"></i>
            <div>
              <h3 class="font-bold text-base tracking-wide leading-tight">PASIVA & PENDAPATAN</h3>
              <p class="text-[10px] text-emerald-100 opacity-80">Posisi Kanan (Kredit)</p>
            </div>
          </div>
          <span class="text-[10px] font-mono bg-white/20 px-2 py-1 rounded backdrop-blur-sm border border-white/10">Normal: KREDIT</span>
        </div>

        <AccountGroup 
          title="KEWAJIBAN / LIABILITIES (2-xxxx)" 
          color="yellow" 
          icon="pi-exclamation-circle"
          :list="groupedAccounts.LIABILITY"
          group-name="LIABILITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @change="onListChange($event, 'LIABILITY')"
        />

        <AccountGroup 
          title="MODAL / EQUITY (3-xxxx)" 
          color="purple" 
          icon="pi-building"
          :list="groupedAccounts.EQUITY"
          group-name="EQUITY"
          @edit="editAccount"
          @remove="deleteAccount"
          @change="onListChange($event, 'EQUITY')"
        />

        <AccountGroup 
          title="PENDAPATAN / REVENUE (4-xxxx)" 
          color="emerald" 
          icon="pi-dollar"
          :list="groupedAccounts.REVENUE"
          group-name="REVENUE"
          @edit="editAccount"
          @remove="deleteAccount"
          @change="onListChange($event, 'REVENUE')"
        />
      </div>
    </div>

    <AccountCreateEditModal
      :is-open="isModalOpen"
      :account-data="selectedAccount"
      @close="isModalOpen = false"
      @refresh="fetchAccounts"
    />
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.sortable-ghost {
  opacity: 0.4;
  background-color: #f3f4f6;
  border: 2px dashed #a5b4fc;
  transform: scale(0.98);
}
.sortable-drag {
  cursor: grabbing;
  opacity: 1 !important;
  background: white;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: rotate(2deg);
}
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 20px;
}
</style>