<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Member & Pelanggan</h1>
        <p class="text-gray-500 text-sm mt-1">Kelola data pelanggan setia toko Anda.</p>
      </div>
      <div class="flex gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:w-64">
          <input 
            v-model="searchQuery" 
            @input="handleSearch"
            placeholder="Cari nama atau no. hp..." 
            class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition text-sm"
          />
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        
        <button 
          @click="openCreateModal"
          class="bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary/90 active:scale-95 transition-all shadow-sm flex items-center gap-2 text-sm font-medium whitespace-nowrap"
        >
          <span>+ Tambah</span>
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div v-if="isLoading" class="p-8 text-center text-gray-400">
        <span class="animate-pulse">Sedang memuat data member...</span>
      </div>

      <table v-else class="w-full text-left border-collapse">
        <thead class="bg-gray-50/50 border-b border-gray-100">
          <tr>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pelanggan</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kontak (Email)</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Terdaftar</th>
            <th class="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in members" :key="item.uuid" class="group hover:bg-gray-50/80 transition-colors">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {{ item.username.substring(0, 2).toUpperCase() }}
                </div>
                <div>
                  <div class="font-bold text-gray-800">{{ item.username }}</div>
                  <div class="text-xs text-gray-400 mt-0.5 font-mono">ID: {{ item.uuid.substring(0, 8) }}...</div>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <span v-if="item.email" class="text-gray-600 text-sm">{{ item.email }}</span>
              <span v-else class="text-gray-300 italic text-sm">- Tidak ada email -</span>
            </td>
            <td class="px-6 py-4">
              <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                {{ new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
              </span>
            </td>
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
          <tr v-if="members.length === 0">
            <td colspan="4" class="px-6 py-12 text-center">
              <div class="flex flex-col items-center justify-center gap-2">
                <div class="text-gray-300 text-4xl mb-2">👥</div>
                <p class="text-gray-500 font-medium">Tidak ada data member</p>
                <p class="text-gray-400 text-sm">Coba ubah kata kunci pencarian atau tambah member baru.</p>
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
            {{ isEditing ? 'Edit Member' : 'Tambah Member Baru' }}
          </h2>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition">✕</button>
        </div>
        
        <div class="p-6 flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Username / Nama / No. HP <span class="text-red-500">*</span></label>
            <input 
              v-model="form.username" 
              placeholder="Contoh: Budi Santoso" 
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Email (Opsional)</label>
            <input 
              v-model="form.email" 
              type="email"
              placeholder="budi@example.com" 
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Password 
              <span v-if="!isEditing" class="text-red-500">*</span>
              <span v-else class="text-xs text-gray-400 font-normal">(Isi hanya jika ingin mengubah)</span>
            </label>
            <input 
              v-model="form.password" 
              type="password"
              placeholder="******" 
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
            @click="handleSave" 
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
// Import composable baru
const { getMembers, createMember, updateMember, updateMemberPassword, deleteMember } = useMemberService();

// State
const members = ref<any>([]);
const isLoading = ref(false);
const showModal = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const editUuid = ref<string | null>(null);
const searchQuery = ref('');

// Debounce Search
let searchTimeout: any;
const handleSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadData();
  }, 500);
};

// Form State
const form = ref({
  username: '',
  email: '',
  password: ''
});

// Load Data
const loadData = async () => {
  isLoading.value = true;
  try {
    members.value = await getMembers(searchQuery.value);
  } catch (error) {
    console.error("Gagal load member", error);
  } finally {
    isLoading.value = false;
  }
};

// Modal Actions
const openCreateModal = () => {
  isEditing.value = false;
  editUuid.value = null;
  form.value = { username: '', email: '', password: '' };
  showModal.value = true;
};

const openEditModal = (item: any) => {
  isEditing.value = true;
  editUuid.value = item.uuid;
  form.value = {
    username: item.username,
    email: item.email || '',
    password: '' // Kosongkan password saat edit
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  form.value = { username: '', email: '', password: '' };
};

// CRUD
const handleSave = async () => {
  if (!form.value.username) return alert("Username wajib diisi");
  if (!isEditing.value && !form.value.password) return alert("Password wajib diisi untuk member baru");

  isSubmitting.value = true;
  try {
    if (isEditing.value && editUuid.value) {
      // 1. Update Data Profil
      await updateMember(editUuid.value, {
        username: form.value.username,
        email: form.value.email
      });
      // 2. Update Password jika diisi
      if (form.value.password) {
        await updateMemberPassword(editUuid.value, form.value.password);
      }
    } else {
      // Create Baru
      await createMember(form.value);
    }
    closeModal();
    loadData();
  } catch (error: any) {
    alert("Gagal menyimpan: " + (error.data?.message || error.message));
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDelete = async (uuid: string) => {
  if (confirm("Apakah Anda yakin ingin menghapus member ini?")) {
    try {
      await deleteMember(uuid);
      loadData();
    } catch (error) {
      alert("Gagal menghapus data");
    }
  }
};

onMounted(() => {
  loadData();
});
</script>