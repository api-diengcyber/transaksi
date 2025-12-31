<template>
  <div class="flex flex-col gap-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold">Member / Pelanggan</h1>
        <p class="text-gray-500">Daftar pelanggan setia (User Role: MEMBER)</p>
      </div>
      <button 
        @click="openCreateModal"
        class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
      >
        <span>+ Tambah Member</span>
      </button>
    </div>

    <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow border border-gray-100 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead class="bg-surface-200 dark:bg-surface-700 border-b">
          <tr>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">ID / No. HP</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Nama / Email</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600">Terdaftar Sejak</th>
            <th class="px-6 py-4 text-sm font-semibold text-gray-600 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in members" :key="item.uuid" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 font-mono text-gray-800">{{ item.username }}</td>
            <td class="px-6 py-4 text-gray-600">{{ item.email }}</td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ new Date(item.createdAt).toLocaleDateString('id-ID') }}
            </td>
            <td class="px-6 py-4 text-right flex justify-end gap-2">
              <button @click="openEditModal(item)" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
              <button @click="confirmDelete(item.uuid)" class="text-red-500 hover:text-red-700 text-sm font-medium">Hapus</button>
            </td>
          </tr>
          <tr v-if="members.length === 0">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">
              Belum ada data member.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UserCreateEditModal
      :show="showModal"
      :user="selectedUser"
      fixed-role="MEMBER" 
      @close="showModal = false"
      @saved="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
// Menggunakan useUserService yang sudah ada
const { fetchUsers, createUser, updateUser, deleteUser } = useUserService();

const members = ref<any>([]);
const showModal = ref(false);
const selectedUser = ref<any>(null);

// Load data khusus role MEMBER
const loadData = async () => {
  try {
    // Memanggil API dengan filter role='MEMBER'
    const res = await fetchUsers('MEMBER'); 
    members.value = res || [];
  } catch (error) {
    console.error("Gagal memuat member", error);
  }
};

const openCreateModal = () => {
  selectedUser.value = null;
  showModal.value = true;
};

const openEditModal = (user: any) => {
  // Mapping data dari tabel ke form modal
  selectedUser.value = {
    ...user,
    // Jika perlu mapping khusus, lakukan di sini
  };
  showModal.value = true;
};

const handleSave = async (formData: any) => {
  try {
    // Siapkan payload
    const payload = {
      username: formData.username,
      email: formData.email,
      roles: [formData.role], // API butuh array of roles
      password: formData.password
    };

    if (selectedUser.value) {
      // Update (jika password kosong, biasanya diabaikan di backend service user update)
      await updateUser(selectedUser.value.uuid, payload);
    } else {
      // Create
      await createUser(payload);
    }
    showModal.value = false;
    await loadData();
  } catch (error: any) {
    alert("Gagal menyimpan data: " + (error.data?.message || error.message));
  }
};

const confirmDelete = async (uuid: string) => {
  if (confirm("Hapus member ini?")) {
    try {
      await deleteUser(uuid);
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