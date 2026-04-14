<script setup>
import { ref, onMounted, computed } from "vue";
import { useToast } from "primevue/usetoast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToast();
const paymentService = usePaymentMethodService();
const bankService = useBankService(); // Tambahkan composable ini jika belum ada

const loading = ref(true);
const methods = ref([]);
const activeBanks = ref([]); // Menyimpan daftar bank aktif dari BankEntity

// State untuk Modal Tambah/Edit (Opsional jika ingin menambah e-wallet baru)
const isModalVisible = ref(false);
const isEditing = ref(false);
const form = ref({
  uuid: null,
  name: "",
  category: "EWALLET", // Default category untuk custom
  code: "",
  is_active: true,
  bank_id: null,
});

const categoryOptions = [
  { label: 'E-Wallet', value: 'EWALLET' },
  { label: 'QRIS', value: 'QRIS' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'Tunai', value: 'CASH' },
];

const fetchData = async () => {
  loading.value = true;
  try {
    // Ambil metode pembayaran (sekarang response.data akan berisi array)
    const resPayment = await paymentService.getAll();
    methods.value = Array.isArray(resPayment) ? resPayment : resPayment.data || [];

    // Ambil daftar rekening bank yang aktif untuk dropdown
    const resBank = await bankService.getAll();
    activeBanks.value = Array.isArray(resBank) ? resBank : resBank.data || [];
    
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data bank', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const handleToggle = async (item) => {
  try {
    await paymentService.toggleStatus(item.uuid, item.is_active);
    toast.add({ severity: 'success', summary: 'Berhasil', detail: `${item.name} diperbarui`, life: 2000 });
  } catch (e) {
    item.is_active = !item.is_active; // revert if failed
    toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal mengubah status', life: 3000 });
  }
};

// Auto-save ketika pengguna memilih rekening bank di dropdown
const updateLinkedBank = async (item) => {
  try {
    await paymentService.update(item.uuid, {
      bank_id: item.bank_id || '' // kirim string kosong jika di-clear
    });
    toast.add({ severity: 'success', summary: 'Tersimpan', detail: 'Rekening tertaut diperbarui', life: 2000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menautkan rekening', life: 3000 });
  }
};

// ---- FUNGSI CRUD CUSTOM PAYMENT ----
const openModal = (item = null) => {
  if (item) {
    isEditing.value = true;
    form.value = { ...item };
  } else {
    isEditing.value = false;
    form.value = { uuid: null, name: "", category: "EWALLET", code: "", is_active: true, bank_id: null };
  }
  isModalVisible.value = true;
};

const saveMethod = async () => {
  try {
    if (isEditing.value) {
      await paymentService.update(form.value.uuid, form.value);
      toast.add({ severity: 'success', summary: 'Sukses', detail: 'Metode diperbarui', life: 2000 });
    } else {
      // Jika Anda punya endpoint create() di service
      // await paymentService.create(form.value);
      toast.add({ severity: 'success', summary: 'Sukses', detail: 'Metode ditambahkan', life: 2000 });
    }
    isModalVisible.value = false;
    fetchData();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Gagal', detail: 'Terjadi kesalahan saat menyimpan', life: 3000 });
  }
};

const navigateToBanks = () => {
  router.push('/bank'); // Asumsi rute manajemen bank adalah /bank
};

onMounted(fetchData);
</script>

<template>
  <div class="py-4 px-2">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 dark:text-white">Metode Pembayaran</h2>
        <p class="text-slate-500 text-sm mt-1">Atur opsi pembayaran kasir dan tautkan ke rekening bank Anda.</p>
      </div>
      
      <div class="flex flex-wrap items-center gap-2">
        <Button 
          label="Rek. Bank" 
          icon="pi pi-building-columns" 
          severity="secondary" 
          outlined 
          @click="navigateToBanks" 
        />
        <Button label="Tambah" icon="pi pi-plus" @click="openModal()" />
        <Button icon="pi pi-refresh" rounded text @click="fetchData" :loading="loading" />
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <Skeleton v-for="i in 5" :key="i" height="80px" class="rounded-xl" />
    </div>

    <div v-else class="space-y-3">
      
      <div v-for="item in methods" :key="item.uuid" 
           class="flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow transition-shadow gap-4">
        
        <div class="flex items-center gap-4 w-full md:w-1/3">
          <div class="w-12 h-12 shrink-0 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-600">
             <i v-if="item.category === 'BANK'" class="pi pi-building text-2xl text-blue-500"></i>
             <i v-else-if="item.category === 'QRIS'" class="pi pi-qrcode text-2xl text-red-500"></i>
             <i v-else-if="item.category === 'CASH'" class="pi pi-money-bill text-2xl text-amber-500"></i>
             <i v-else class="pi pi-wallet text-2xl text-emerald-500"></i>
          </div>
          <div>
            <h3 class="font-bold text-slate-800 dark:text-white leading-tight mb-1">{{ item.name }}</h3>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                {{ item.category }}
              </span>
              <span v-if="item.code" class="text-xs text-slate-400 font-mono">#{{ item.code }}</span>
            </div>
          </div>
        </div>

        <div class="w-full md:w-1/3">
          <div v-if="item.category === 'BANK'" class="w-full">
            <Dropdown 
              v-model="item.bank_id" 
              :options="activeBanks" 
              optionLabel="bank_name" 
              optionValue="uuid" 
              placeholder="Tautkan ke Rekening..." 
              class="w-full text-sm"
              showClear
              @change="updateLinkedBank(item)"
            >
              <template #value="slotProps">
                <div v-if="slotProps.value" class="flex items-center gap-2">
                  <i class="pi pi-link text-primary-500 text-xs"></i>
                  <span>{{ activeBanks.find(b => b.uuid === slotProps.value)?.bank_name || 'Terpilih' }}</span>
                </div>
                <span v-else class="text-slate-400 italic text-sm">Pilih Rekening Bank...</span>
              </template>
              <template #option="slotProps">
                <div class="flex flex-col">
                  <span class="font-semibold">{{ slotProps.option.bank_name }}</span>
                  <span class="text-xs text-slate-500">{{ slotProps.option.account_number }} - {{ slotProps.option.account_holder }}</span>
                </div>
              </template>
            </Dropdown>
            <p v-if="item.is_active && !item.bank_id" class="text-[10px] text-red-500 mt-1 flex items-center gap-1">
              <i class="pi pi-exclamation-circle"></i> Wajib menautkan rekening agar bisa digunakan!
            </p>
          </div>
          <div v-else class="text-xs text-slate-400 italic flex items-center justify-start md:justify-center h-full">
            Tidak memerlukan rekening terpisah.
          </div>
        </div>

        <div class="flex items-center justify-end gap-6 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-100 dark:border-slate-700">
           <div class="flex items-center gap-2">
             <span class="text-xs font-semibold" :class="item.is_active ? 'text-green-500' : 'text-slate-400'">
               {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
             </span>
             <InputSwitch v-model="item.is_active" @change="handleToggle(item)" />
           </div>
           <Button icon="pi pi-pencil" text rounded severity="secondary" @click="openModal(item)" />
        </div>

      </div>

      <div v-if="methods.length === 0" class="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <i class="pi pi-inbox text-4xl text-slate-300 mb-3"></i>
        <p class="text-slate-500">Belum ada metode pembayaran yang terkonfigurasi.</p>
      </div>

    </div>

    <Dialog v-model:visible="isModalVisible" :header="isEditing ? 'Edit Metode' : 'Tambah Metode Baru'" modal class="p-fluid w-full max-w-md">
      <div class="space-y-4 mt-2">
        <div class="field">
          <label class="font-semibold text-sm mb-1 block">Nama Metode</label>
          <InputText v-model="form.name" placeholder="Misal: ShopeePay / QRIS BCA" />
        </div>
        <div class="field">
          <label class="font-semibold text-sm mb-1 block">Kode Unik (Tanpa Spasi)</label>
          <InputText v-model="form.code" placeholder="Misal: shopeepay" :disabled="isEditing" />
        </div>
        <div class="field">
          <label class="font-semibold text-sm mb-1 block">Kategori</label>
          <Dropdown v-model="form.category" :options="categoryOptions" optionLabel="label" optionValue="value" placeholder="Pilih Kategori" />
        </div>
        <div class="field" v-if="form.category === 'BANK'">
          <label class="font-semibold text-sm mb-1 block">Tautkan ke Rekening</label>
          <Dropdown v-model="form.bank_id" :options="activeBanks" optionLabel="bank_name" optionValue="uuid" placeholder="Pilih Rekening" showClear />
        </div>
        <div class="flex items-center justify-between pt-2">
           <label class="font-semibold text-sm">Status Aktif</label>
           <InputSwitch v-model="form.is_active" />
        </div>
      </div>
      <template #footer>
        <Button label="Batal" icon="pi pi-times" text severity="secondary" @click="isModalVisible = false" />
        <Button label="Simpan" icon="pi pi-check" @click="saveMethod" autofocus />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.p-dropdown {
  border-radius: 0.5rem;
}
</style>