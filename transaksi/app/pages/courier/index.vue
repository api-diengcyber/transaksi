<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Manajemen Ekspedisi</h1>
        <p class="text-gray-500">Daftar layanan kurir yang tersedia (JNE, SPX, dll)</p>
      </div>
      <button 
        @click="showCreateModal = true"
        class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
      >
        <span>+ Tambah Kurir</span>
      </button>
    </div>

    <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Nama Ekspedisi</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Terdaftar Pada</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in couriers" :key="item.id" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-medium text-gray-800">{{ item.name }}</td>
            <td class="px-6 py-4 text-gray-500 text-sm">
              {{ new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) }}
            </td>
            <td class="px-6 py-4 text-right">
              <button 
                @click="confirmDelete(item.id)" 
                class="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition"
              >
                Hapus
              </button>
            </td>
          </tr>
          <tr v-if="couriers.length === 0">
            <td colspan="3" class="px-6 py-8 text-center text-gray-400">
              Belum ada data ekspedisi. Silakan tambah baru.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 transform transition-all scale-100">
        <h2 class="text-xl font-bold mb-4">Tambah Ekspedisi Baru</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Nama Ekspedisi</label>
          <input 
            v-model="newCourierName" 
            type="text" 
            placeholder="Contoh: JNE, J&T, SiCepat" 
            class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            @keyup.enter="handleCreate"
            ref="inputFocus"
          />
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button 
            @click="showCreateModal = false" 
            class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Batal
          </button>
          <button 
            @click="handleCreate" 
            :disabled="!newCourierName"
            class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Menggunakan service yang sudah dibuat
const { getCouriers, createCourier, deleteCourier } = useCourierService();

const couriers = ref<any>([]);
const showCreateModal = ref(false);
const newCourierName = ref('');

// Load Data
const loadData = async () => {
  try {
    couriers.value = await getCouriers();
  } catch (error) {
    console.error("Gagal memuat data kurir", error);
  }
};

// Handle Create
const handleCreate = async () => {
  if (!newCourierName.value) return;
  try {
    await createCourier(newCourierName.value);
    newCourierName.value = ''; // Reset form
    showCreateModal.value = false; // Tutup modal
    await loadData(); // Refresh data
  } catch (error) {
    alert("Gagal menambah data");
  }
};

// Handle Delete
const confirmDelete = async (id: string) => {
  if (confirm("Apakah Anda yakin ingin menghapus ekspedisi ini?")) {
    try {
      await deleteCourier(id);
      await loadData();
    } catch (error) {
      alert("Gagal menghapus data");
    }
  }
};

// Lifecycle
onMounted(() => {
  loadData();
});
</script>