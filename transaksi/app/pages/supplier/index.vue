<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold">Supplier</h1>
        <p class="text-gray-500">Daftar supplier terdaftar di sistem (User Role: SUPPLIER)</p>
      </div>
      <button 
        @click="openCreateModal"
        class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
      >
        <span>+ Tambah Supplier</span>
      </button>
    </div>

    <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-surface-200 dark:bg-surface-100 border-b">
          <tr>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Nama Supplier</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Kontak / Email</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in suppliers" :key="item.id" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-medium text-gray-800">{{ item.name }}</td>
            <td class="px-6 py-4 text-gray-600">{{ item.email }}</td>
            <td class="px-6 py-4 text-right flex justify-end gap-2">
              <button @click="openEditModal(item)" class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button @click="confirmDelete(item.id)" class="text-red-500 hover:text-red-700 text-sm">Hapus</button>
            </td>
          </tr>
          <tr v-if="suppliers.length === 0">
            <td colspan="3" class="px-6 py-8 text-center text-gray-400">
              Belum ada data supplier.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UserCreateEditModal
      :show="showModal"
      :user="selectedUser"
      fixed-role="SUPPLIER" 
      @close="showModal = false"
      @saved="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
const { fetchUsers, createUser, updateUser, deleteUser } = useUserService();

const suppliers = ref<any>([]);
const showModal = ref(false);
const selectedUser = ref<any>(null);

// Load data khusus role SUPPLIER
const loadData = async () => {
  try {
    const res = await fetchUsers('SUPPLIER');
    suppliers.value = res || [];
  } catch (error) {
    console.error("Gagal memuat supplier", error);
  }
};

const openCreateModal = () => {
  selectedUser.value = null;
  showModal.value = true;
};

const openEditModal = (user: any) => {
  selectedUser.value = user;
  showModal.value = true;
};

const handleSave = async (formData: any) => {
  try {
    if (selectedUser.value) {
      await updateUser(selectedUser.value.id, formData);
    } else {
      await createUser(formData);
    }
    showModal.value = false;
    loadData();
  } catch (error) {
    alert("Gagal menyimpan data");
  }
};

const confirmDelete = async (id: string) => {
  if (confirm("Hapus supplier ini?")) {
    await deleteUser(id);
    loadData();
  }
};

onMounted(() => {
  loadData();
});
</script>