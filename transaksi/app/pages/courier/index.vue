<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Logistik & Ekspedisi</h1>
        <p class="text-gray-500">Kelola penyedia kurir dan pengaturan biaya rute pengiriman</p>
      </div>
    </div>

    <div class="flex gap-4 border-b">
      <button 
        @click="activeTab = 'courier'"
        :class="activeTab === 'courier' ? 'border-b-2 border-primary text-primary font-bold' : 'text-gray-500'"
        class="pb-2 px-4 transition-all"
      >
        Daftar Ekspedisi
      </button>
      <button 
        @click="activeTab = 'route'"
        :class="activeTab === 'route' ? 'border-b-2 border-primary text-primary font-bold' : 'text-gray-500'"
        class="pb-2 px-4 transition-all"
      >
        Biaya Rute (Ongkir)
      </button>
    </div>

    <div v-if="activeTab === 'courier'" class="flex flex-col gap-4">
      <div class="flex justify-end">
        <button @click="showCourierModal = true" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">
          + Tambah Kurir
        </button>
      </div>
      <div class="bg-surface-0 rounded-xl shadow border border-gray-100 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-4 text-sm font-semibold text-gray-600">Nama Ekspedisi</th>
              <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in couriers" :key="item.uuid" class="hover:bg-gray-50">
              <td class="px-6 py-4 font-medium">{{ item.name }}</td>
              <td class="px-6 py-4 text-right">
                <button @click="confirmDelete(item.uuid)" class="text-red-500 hover:bg-red-50 px-3 py-1 rounded">Hapus</button>
              </td>
            </tr>
            <tr v-if="couriers.length === 0">
              <td colspan="2" class="px-6 py-8 text-center text-gray-400">Belum ada data ekspedisi.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="flex flex-col gap-4">
      <div class="flex justify-end">
        <button @click="showRouteModal = true" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">
          + Tambah Biaya Rute
        </button>
      </div>
      <div class="bg-surface-0 rounded-xl shadow border border-gray-100 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-4 text-sm font-semibold text-gray-600">Kurir</th>
              <th class="px-6 py-4 text-sm font-semibold text-gray-600">Rute (Asal → Tujuan)</th>
              <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Biaya (Ongkir)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="route in routes" :key="route.uuid" class="hover:bg-gray-50">
              <td class="px-6 py-4 font-medium">{{ route.courier?.name }}</td>
              <td class="px-6 py-4 text-sm text-gray-600">{{ route.origin }} → {{ route.destination }}</td>
              <td class="px-6 py-4 text-right font-bold text-green-600">
                Rp {{ new Intl.NumberFormat('id-ID').format(route.price) }}
              </td>
            </tr>
            <tr v-if="routes.length === 0">
              <td colspan="3" class="px-6 py-8 text-center text-gray-400">Belum ada rute tarif.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showRouteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-surface-0 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 class="text-xl font-bold mb-4">Tambah Tarif Rute</h2>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Pilih Kurir</label>
            <select v-model="routeForm.courier_uuid" class="w-full border rounded-lg px-3 py-2 outline-none">
              <option value="">-- Pilih Ekspedisi --</option>
              <option v-for="c in couriers" :key="c.uuid" :value="c.uuid">{{ c.name }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">Kota Asal</label>
              <input v-model="routeForm.origin" type="text" class="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Wonosobo" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Kota Tujuan</label>
              <input v-model="routeForm.destination" type="text" class="w-full border rounded-lg px-3 py-2" placeholder="Contoh: Jakarta" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Biaya (Ongkir)</label>
            <input v-model="routeForm.price" type="number" class="w-full border rounded-lg px-3 py-2" placeholder="0" />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showRouteModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button @click="handleCreateRoute" class="bg-primary text-white px-4 py-2 rounded-lg" :disabled="!routeForm.courier_uuid">Simpan</button>
        </div>
      </div>
    </div>

    <div v-if="showCourierModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-surface-0 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 class="text-xl font-bold mb-4">Tambah Ekspedisi Baru</h2>
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Nama Ekspedisi</label>
            <input 
              v-model="newCourierName" 
              type="text" 
              class="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50" 
              placeholder="Contoh: JNE, J&T, Sicepat" 
              @keyup.enter="handleCreate"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showCourierModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
          <button 
            @click="handleCreate" 
            class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50" 
            :disabled="!newCourierName"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const { getCouriers, createCourier, deleteCourier, getRoutes, createRoute } = useCourierService();

const activeTab = ref('courier'); // State untuk kontrol tab
const couriers = ref<any>([]);
const routes = ref<any>([]);

// Modals & Forms
const showCourierModal = ref(false);
const showRouteModal = ref(false);
const newCourierName = ref('');
const routeForm = ref({ courier_uuid: '', origin: '', destination: '', price: 0 });

const loadData = async () => {
  try {
    const [cData, rData] = await Promise.all([getCouriers(), getRoutes()]);
    couriers.value = cData || [];
    routes.value = rData || [];
  } catch (err) { console.error(err); }
};

const handleCreateRoute = async () => {
  try {
    await createRoute(routeForm.value);
    showRouteModal.value = false;
    routeForm.value = { courier_uuid: '', origin: '', destination: '', price: 0 };
    await loadData();
  } catch (err) { alert("Gagal simpan rute"); }
};

// Handle Create Courier (DIPERBAIKI)
const handleCreate = async () => {
  if (!newCourierName.value) return;
  try {
    await createCourier(newCourierName.value);
    newCourierName.value = ''; // Reset form
    showCourierModal.value = false; // Fix: Tutup modal kurir, bukan modal rute
    await loadData(); // Refresh data
  } catch (error) {
    alert("Gagal menambah data ekspedisi");
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

onMounted(() => {
  loadData();
});
</script>