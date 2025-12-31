<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Bank & Rekening</h1>
        <p class="text-gray-500">Daftar rekening bank toko untuk penerimaan pembayaran</p>
      </div>
      <button 
        @click="openModal"
        class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
      >
        <span>+ Tambah Bank</span>
      </button>
    </div>

    <div class="bg-surface-0 rounded-xl shadow border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Nama Bank</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">No. Rekening</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Atas Nama</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in banks" :key="item.id" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-medium text-gray-800">{{ item.bank_name }}</td>
            <td class="px-6 py-4 font-mono text-gray-600">{{ item.account_number }}</td>
            <td class="px-6 py-4 text-gray-600">{{ item.account_holder }}</td>
            <td class="px-6 py-4 text-right">
              <button 
                @click="confirmDelete(item.id)" 
                class="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition"
              >
                Hapus
              </button>
            </td>
          </tr>
          <tr v-if="banks.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">
              Belum ada data bank. Silakan tambah baru.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-surface-0 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 class="text-xl font-bold mb-4">Tambah Rekening Bank</h2>
        
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
            <input 
              v-model="form.bank_name" 
              placeholder="Contoh: BCA, Mandiri" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nomor Rekening</label>
            <input 
              v-model="form.account_number" 
              type="number"
              placeholder="Contoh: 1234567890" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Atas Nama</label>
            <input 
              v-model="form.account_holder" 
              placeholder="Nama pemilik rekening" 
              class="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="showModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button @click="handleSubmit" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">Simpan</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { getBanks, createBank, deleteBank } = useBankService();

const banks = ref<any>([]);
const showModal = ref(false);
const form = ref({
  bank_name: '',
  account_number: '',
  account_holder: ''
});

const loadData = async () => {
  try {
    banks.value = await getBanks();
  } catch (error) {
    console.error("Gagal load bank", error);
  }
};

const openModal = () => {
  form.value = { bank_name: '', account_number: '', account_holder: '' };
  showModal.value = true;
};

const handleSubmit = async () => {
  if (!form.value.bank_name || !form.value.account_number) return alert("Lengkapi data");
  
  try {
    await createBank(form.value);
    showModal.value = false;
    loadData();
  } catch (error) {
    alert("Gagal menyimpan");
  }
};

const confirmDelete = async (id: string) => {
  if (confirm("Hapus rekening ini?")) {
    await deleteBank(id);
    loadData();
  }
};

onMounted(() => {
  loadData();
});
</script>