<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Bank & Rekening</h1>
        <p class="text-gray-500 text-sm mt-1">Kelola daftar rekening bank toko untuk transaksi.</p>
      </div>
      <button 
        @click="openCreateModal"
        class="bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary/90 active:scale-95 transition-all shadow-sm flex items-center gap-2 text-sm font-medium"
      >
        <span>+ Tambah Bank</span>
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="isLoadingData" class="p-8 text-center text-gray-400">
        Memuat data...
      </div>

      <table v-else class="w-full text-left border-collapse">
        <thead class="bg-gray-50/50 border-b border-gray-100">
          <tr>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Bank</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">No. Rekening</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Atas Nama</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in banks" :key="item.uuid" class="group hover:bg-gray-50/80 transition-colors">
            <td class="px-6 py-4">
              <div class="font-bold text-gray-800">{{ item.bank_name }}</div>
              <div class="text-xs text-gray-400 font-mono mt-0.5">{{ item.uuid }}</div>
            </td>
            <td class="px-6 py-4">
               <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-mono font-medium border border-blue-100">
                 {{ item.account_number }}
               </span>
            </td>
            <td class="px-6 py-4 text-gray-600 font-medium">{{ item.account_holder }}</td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  @click="openEditModal(item)" 
                  class="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  Edit
                </button>
                <button 
                  @click="confirmDelete(item.uuid)" 
                  class="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  Hapus
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="banks.length === 0">
            <td colspan="4" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center justify-center gap-2">
                <div class="text-gray-300 text-4xl mb-2">🏦</div>
                <p class="text-gray-500 font-medium">Belum ada data bank</p>
                <p class="text-gray-400 text-sm">Silakan tambah rekening baru untuk memulai.</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 class="text-lg font-bold text-gray-800">
            {{ isEditing ? 'Edit Rekening Bank' : 'Tambah Rekening Baru' }}
          </h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition">
            ✕
          </button>
        </div>
        
        <div class="p-6 flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Bank</label>
            <input 
              v-model="form.bank_name" 
              placeholder="Contoh: BCA, Mandiri, BRI" 
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Nomor Rekening</label>
            <input 
              v-model="form.account_number" 
              type="text"
              placeholder="Contoh: 1234567890" 
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm font-mono"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Atas Nama</label>
            <input 
              v-model="form.account_holder" 
              placeholder="Nama pemilik rekening" 
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
            />
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            @click="closeModal" 
            class="px-4 py-2 text-gray-600 hover:bg-gray-200/50 rounded-lg text-sm font-medium transition"
          >
            Batal
          </button>
          <button 
            @click="handleSubmit" 
            :disabled="isSubmitting"
            class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm text-sm font-medium transition flex items-center gap-2"
          >
            <span v-if="isSubmitting">Menyimpan...</span>
            <span v-else>Simpan</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Menggunakan composable yang sudah diperbarui
const { getBanks, createBank, updateBank, deleteBank } = useBankService();

// State
const banks = ref<any>([]);
const isLoadingData = ref(false);
const showModal = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const editId = ref<string | null>(null);

// Form State
const form = ref({
  bank_name: '',
  account_number: '',
  account_holder: ''
});

// Load Data
const loadData = async () => {
  isLoadingData.value = true;
  try {
    banks.value = await getBanks();
  } catch (error) {
    console.error("Gagal load bank", error);
  } finally {
    isLoadingData.value = false;
  }
};

// Modal Actions
const openCreateModal = () => {
  isEditing.value = false;
  editId.value = null;
  form.value = { bank_name: '', account_number: '', account_holder: '' };
  showModal.value = true;
};

const openEditModal = (item: any) => {
  isEditing.value = true;
  editId.value = item.uuid; // Pastikan menggunakan uuid sesuai response backend
  form.value = {
    bank_name: item.bank_name,
    account_number: item.account_number,
    account_holder: item.account_holder
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  form.value = { bank_name: '', account_number: '', account_holder: '' };
};

// CRUD Actions
const handleSubmit = async () => {
  if (!form.value.bank_name || !form.value.account_number || !form.value.account_holder) {
    // Bisa diganti dengan toast notification jika ada librarynya
    alert("Harap lengkapi semua data"); 
    return;
  }
  
  isSubmitting.value = true;
  try {
    if (isEditing.value && editId.value) {
      await updateBank(editId.value, form.value);
    } else {
      await createBank(form.value);
    }
    closeModal();
    await loadData();
  } catch (error) {
    console.error(error);
    alert("Gagal menyimpan data. Silakan coba lagi.");
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDelete = async (id: string) => {
  if (confirm("Apakah Anda yakin ingin menghapus rekening ini?")) {
    try {
      await deleteBank(id);
      await loadData();
    } catch (error) {
      alert("Gagal menghapus data");
    }
  }
};

onMounted(() => {
  loadData();
});
</script>