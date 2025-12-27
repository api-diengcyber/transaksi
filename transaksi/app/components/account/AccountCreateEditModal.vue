<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  accountData?: any;
}>();

const emit = defineEmits(['close', 'refresh']);
const { create, update } = useAccountService(); // Pastikan composable ini tersedia

const isLoading = ref(false);
const isEdit = ref(false);

const form = ref({
  code: '',
  name: '',
  category: 'ASSET',
  normalBalance: 'DEBIT',
});

// Reset form saat modal dibuka
watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      if (props.accountData) {
        isEdit.value = true;
        // Copy object agar tidak merubah data asli di parent sebelum save
        form.value = { ...props.accountData };
      } else {
        isEdit.value = false;
        form.value = {
          code: '',
          name: '',
          category: 'ASSET',
          normalBalance: 'DEBIT',
        };
      }
    }
  }
);

const closeModal = () => {
  emit('close');
};

const onSubmit = async () => {
  try {
    isLoading.value = true;
    if (isEdit.value && props.accountData?.uuid) {
      await update(props.accountData.uuid, form.value);
    } else {
      await create(form.value);
    }
    emit('refresh');
    closeModal();
  } catch (error: any) {
    alert(error?.response?._data?.message || 'Terjadi kesalahan saat menyimpan');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog as="div" @close="closeModal" class="relative z-50">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/25" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all"
            >
              <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900 mb-4">
                {{ isEdit ? 'Edit Akun' : 'Tambah Akun Baru' }}
              </DialogTitle>

              <form @submit.prevent="onSubmit" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700">Kode Akun (Alpha-Numeric)</label>
                  <div class="relative mt-1 rounded-md shadow-sm">
                    <input
                      v-model="form.code"
                      type="text"
                      required
                      class="block w-full rounded-md border-gray-300 pl-3 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 font-mono"
                      placeholder="Cth: 1-1001 atau A-001"
                    />
                  </div>
                  <p class="mt-1 text-xs text-gray-500">Gunakan format angka atau huruf untuk sub-level.</p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Nama Akun</label>
                  <input
                    v-model="form.name"
                    type="text"
                    required
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    placeholder="Contoh: Kas Kecil"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Kategori</label>
                  <select
                    v-model="form.category"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="ASSET">Harta (ASSET)</option>
                    <option value="LIABILITY">Kewajiban (LIABILITY)</option>
                    <option value="EQUITY">Modal (EQUITY)</option>
                    <option value="REVENUE">Pendapatan (REVENUE)</option>
                    <option value="EXPENSE">Beban (EXPENSE)</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700">Saldo Normal</label>
                  <select
                    v-model="form.normalBalance"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Kredit</option>
                  </select>
                </div>

                <div class="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none"
                    @click="closeModal"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none"
                    :disabled="isLoading"
                  >
                    {{ isLoading ? 'Menyimpan...' : 'Simpan' }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>