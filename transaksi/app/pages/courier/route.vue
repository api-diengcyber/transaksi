<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Tarif Rute Pengiriman</h1>
        <p class="text-gray-500">Kelola biaya kirim berdasarkan asal dan tujuan</p>
      </div>
      <button @click="showModal = true" class="bg-primary text-white px-4 py-2 rounded-lg">+ Tambah Rute</button>
    </div>

    <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Ekspedisi</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Rute (Asal -> Tujuan)</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Biaya</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="route in routes" :key="route.uuid" class="hover:bg-gray-50">
            <td class="px-6 py-4 font-medium">{{ route.courier?.name }}</td>
            <td class="px-6 py-4">{{ route.origin }} → {{ route.destination }}</td>
            <td class="px-6 py-4 text-green-600 font-bold">Rp {{ new Intl.NumberFormat('id-ID').format(route.price) }}</td>
            <td class="px-6 py-4 text-right">
              <button class="text-red-500 hover:underline">Hapus</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">Tambah Tarif Rute</h2>
        <div class="flex flex-col gap-4">
          <select v-model="form.courier_uuid" class="border p-2 rounded-lg">
            <option value="">Pilih Kurir</option>
            <option v-for="c in couriers" :key="c.uuid" :value="c.uuid">{{ c.name }}</option>
          </select>
          <input v-model="form.origin" placeholder="Kota Asal" class="border p-2 rounded-lg" />
          <input v-model="form.destination" placeholder="Kota Tujuan" class="border p-2 rounded-lg" />
          <input v-model="form.price" type="number" placeholder="Biaya (Rp)" class="border p-2 rounded-lg" />
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showModal = false">Batal</button>
          <button @click="saveRoute" class="bg-primary text-white px-4 py-2 rounded-lg">Simpan Rute</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { getCouriers, getRoutes, createRoute } = useCourierService();
const routes = ref();
const couriers = ref();
const showModal = ref(false);
const form = ref({ courier_uuid: '', origin: '', destination: '', price: 0 });

const loadData = async () => {
  const [dataRoutes, dataCouriers] = await Promise.all([getRoutes(), getCouriers()]);
  routes.value = dataRoutes;
  couriers.value = dataCouriers;
};

const saveRoute = async () => {
  await createRoute(form.value);
  showModal.value = false;
  await loadData();
};

onMounted(loadData);
</script>