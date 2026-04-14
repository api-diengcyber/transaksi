

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// Perbaikan: Gunakan method sesuai return dari useBankService.ts
const { getAll, create, update, remove } = useBankService();

// State
const banks = ref<any>([]);
const isLoadingData = ref(false);
const showModal = ref(false);
const isEditing = ref(false);
const isSubmitting = ref(false);
const editId = ref<string | null>(null);

// Form State
const form = reactive({
  bank_name: '',
  bank_code: '', // Ditambahkan sesuai entity NestJS
  account_number: '',
  account_holder: ''
});

// Simple Validation State
const v$ = reactive({
  bank_name: { $error: false },
  account_number: { $error: false },
  account_holder: { $error: false }
});

// Load Data
const loadData = async () => {
  isLoadingData.value = true;
  try {
    const response = await getAll();
    // Perbaikan: Tangani pembungkus response.data jika ada
    banks.value = Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data bank', life: 3000 });
  } finally {
    isLoadingData.value = false;
  }
};

// Modal Actions
const openCreateModal = () => {
  isEditing.value = false;
  editId.value = null;
  form.bank_name = '';
  form.bank_code = '';
  form.account_number = '';
  form.account_holder = '';
  
  // Reset validation
  Object.keys(v$).forEach((k: any) => v$[k as keyof typeof v$].$error = false);
  
  showModal.value = true;
};

const openEditModal = (item: any) => {
  isEditing.value = true;
  editId.value = item.uuid;
  form.bank_name = item.bank_name || '';
  form.bank_code = item.bank_code || '';
  form.account_number = item.account_number || '';
  form.account_holder = item.account_holder || '';
  
  // Reset validation
  Object.keys(v$).forEach((k: any) => v$[k as keyof typeof v$].$error = false);

  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

// Validasi Manual
const validateForm = () => {
  v$.bank_name.$error = !form.bank_name.trim();
  v$.account_number.$error = !form.account_number.trim();
  v$.account_holder.$error = !form.account_holder.trim();
  
  return !v$.bank_name.$error && !v$.account_number.$error && !v$.account_holder.$error;
};

// CRUD Actions
const handleSubmit = async () => {
  if (!validateForm()) {
    toast.add({ severity: 'warn', summary: 'Peringatan', detail: 'Harap lengkapi field yang wajib diisi', life: 3000 });
    return;
  }
  
  isSubmitting.value = true;
  try {
    if (isEditing.value && editId.value) {
      await update(editId.value, form);
      toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Data bank diperbarui', life: 2000 });
    } else {
      await create(form);
      toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Rekening bank baru ditambahkan', life: 2000 });
    }
    closeModal();
    await loadData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal menyimpan data. Periksa kembali jaringan atau isian Anda.', life: 3000 });
  } finally {
    isSubmitting.value = false;
  }
};

const confirmDelete = (item: any) => {
  confirm.require({
    message: `Apakah Anda yakin ingin menghapus rekening ${item.bank_name} (${item.account_number})?`,
    header: 'Konfirmasi Hapus',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Ya, Hapus',
    rejectLabel: 'Batal',
    accept: async () => {
      try {
        await remove(item.uuid);
        toast.add({ severity: 'success', summary: 'Dihapus', detail: 'Rekening berhasil dihapus', life: 2000 });
        await loadData();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus data rekening', life: 3000 });
      }
    }
  });
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="flex flex-col gap-6 p-4 md:p-6 min-h-screen bg-surface-50 dark:bg-surface-900">
    <Toast />
    <ConfirmDialog />

    <div class="flex justify-between items-start md:items-center flex-col md:flex-row gap-4 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-white">Bank & Rekening</h1>
        <p class="text-slate-500 text-sm mt-1">Kelola daftar rekening bank toko untuk transaksi penerimaan dan pengeluaran.</p>
      </div>
      <Button 
        label="Tambah Bank" 
        icon="pi pi-plus" 
        class="p-button-primary px-5 py-2.5 rounded-xl shadow-sm font-medium"
        @click="openCreateModal"
      />
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      
      <div v-if="isLoadingData" class="p-8 text-center text-slate-400 flex flex-col items-center gap-3">
        <i class="pi pi-spin pi-spinner text-3xl text-primary"></i>
        <span>Memuat data rekening...</span>
      </div>

      <table v-else class="w-full text-left border-collapse">
        <thead class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nama Bank</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No. Rekening</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atas Nama</th>
            <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          
          <tr v-for="item in banks" :key="item.uuid" class="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
            <td class="px-6 py-4">
              <div class="font-bold text-slate-800 dark:text-white">{{ item.bank_name }}</div>
              <div class="text-xs text-slate-400 font-mono mt-0.5" v-if="item.bank_code">Kode: {{ item.bank_code }}</div>
            </td>
            <td class="px-6 py-4">
               <span class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border border-blue-100 dark:border-blue-800">
                 {{ item.account_number || '-' }}
               </span>
            </td>
            <td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
              {{ item.account_holder || '-' }}
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  icon="pi pi-pencil" 
                  severity="warn" 
                  text 
                  rounded 
                  v-tooltip.top="'Edit'"
                  @click="openEditModal(item)" 
                />
                <Button 
                  icon="pi pi-trash" 
                  severity="danger" 
                  text 
                  rounded 
                  v-tooltip.top="'Hapus'"
                  @click="confirmDelete(item)" 
                />
              </div>
            </td>
          </tr>

          <tr v-if="banks.length === 0">
            <td colspan="4" class="px-6 py-16 text-center">
              <div class="flex flex-col items-center justify-center gap-3">
                <i class="pi pi-building-columns text-5xl text-slate-300 dark:text-slate-600 mb-2"></i>
                <p class="text-slate-500 font-medium text-lg">Belum ada data bank</p>
                <p class="text-slate-400 text-sm">Silakan tambah rekening baru untuk mulai menerima pembayaran transfer.</p>
              </div>
            </td>
          </tr>

        </tbody>
      </table>
    </div>

    <Dialog 
      v-model:visible="showModal" 
      :header="isEditing ? 'Edit Rekening Bank' : 'Tambah Rekening Baru'" 
      modal 
      class="p-fluid w-full max-w-md"
      :closable="!isSubmitting"
    >
      <div class="flex flex-col gap-4 mt-2">
        <div class="field">
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nama Bank</label>
          <InputText 
            v-model="form.bank_name" 
            placeholder="Contoh: BCA, Mandiri, BRI" 
            :class="{ 'p-invalid': v$.bank_name.$error }"
          />
          <small v-if="v$.bank_name.$error" class="p-error">Nama bank wajib diisi.</small>
        </div>
        
        <div class="field">
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Kode Bank (Opsional)</label>
          <InputText 
            v-model="form.bank_code" 
            placeholder="Contoh: BCA" 
            class="uppercase"
          />
        </div>

        <div class="field">
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nomor Rekening</label>
          <InputText 
            v-model="form.account_number" 
            placeholder="Contoh: 1234567890" 
            class="font-mono"
            :class="{ 'p-invalid': v$.account_number.$error }"
          />
          <small v-if="v$.account_number.$error" class="p-error">Nomor rekening wajib diisi.</small>
        </div>

        <div class="field">
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Atas Nama</label>
          <InputText 
            v-model="form.account_holder" 
            placeholder="Nama pemilik rekening" 
            :class="{ 'p-invalid': v$.account_holder.$error }"
          />
          <small v-if="v$.account_holder.$error" class="p-error">Nama pemilik wajib diisi.</small>
        </div>
      </div>

      <template #footer>
        <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="closeModal" :disabled="isSubmitting" />
        <Button :label="isSubmitting ? 'Menyimpan...' : 'Simpan'" icon="pi pi-check" @click="handleSubmit" :loading="isSubmitting" autofocus />
      </template>
    </Dialog>

  </div>
</template>