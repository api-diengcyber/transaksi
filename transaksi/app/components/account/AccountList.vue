<template>
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-lg font-semibold text-gray-900">Daftar Akun (COA)</h2>
      <button
        @click="openCreateModal"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
      >
        + Tambah Akun
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Akun</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Normal</th>
            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="loading" class="text-center">
            <td colspan="5" class="py-4 text-sm text-gray-500">Memuat data...</td>
          </tr>
          <tr v-else-if="accounts.length === 0" class="text-center">
            <td colspan="5" class="py-4 text-sm text-gray-500">Belum ada akun terdaftar.</td>
          </tr>
          <tr v-for="account in accounts" :key="account.uuid" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ account.code }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ account.name }}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="getCategoryColor(account.category)">
                {{ account.category }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span :class="account.normalBalance === 'DEBIT' ? 'text-green-600' : 'text-red-600'">
                {{ account.normalBalance }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button @click="editAccount(account)" class="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
              <button 
                v-if="!account.isSystem" 
                @click="deleteAccount(account.uuid)" 
                class="text-red-600 hover:text-red-900"
              >
                Hapus
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AccountCreateEditModal
      :is-open="isModalOpen"
      :account-data="selectedAccount"
      @close="isModalOpen = false"
      @refresh="fetchAccounts"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AccountCreateEditModal from './AccountCreateEditModal.vue';

const { getAll, remove } = useAccountService();

const accounts = ref<any>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const selectedAccount = ref(null);

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const res = await getAll();
    accounts.value = res || [];
  } catch (error) {
    console.error('Gagal mengambil data akun', error);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  selectedAccount.value = null;
  isModalOpen.value = true;
};

const editAccount = (account: any) => {
  selectedAccount.value = account;
  isModalOpen.value = true;
};

const deleteAccount = async (uuid: string) => {
  if (!confirm('Apakah Anda yakin ingin menghapus akun ini?')) return;
  try {
    await remove(uuid);
    fetchAccounts();
  } catch (error: any) {
    alert(error?.response?._data?.message || 'Gagal menghapus akun');
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'ASSET': return 'bg-blue-100 text-blue-800';
    case 'LIABILITY': return 'bg-yellow-100 text-yellow-800';
    case 'EQUITY': return 'bg-purple-100 text-purple-800';
    case 'REVENUE': return 'bg-green-100 text-green-800';
    case 'EXPENSE': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

onMounted(() => {
  fetchAccounts();
});
</script>