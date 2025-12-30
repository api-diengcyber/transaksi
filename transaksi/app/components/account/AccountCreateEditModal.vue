<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  TransitionRoot,
  TransitionChild,
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/vue';

// 1. Terima prop categories dari parent
const props = defineProps<{
  isOpen: boolean;
  accountData?: any;
  availableAccounts?: any[]; 
  categories?: any[]; // Array of { value: string, label: string }
}>();

const emit = defineEmits(['close', 'refresh']);
const { create, update } = useAccountService();

const isLoading = ref(false);
const isEdit = ref(false);

const form = ref({
  code: '',
  name: '',
  category: 'ASSET',
  normalBalance: 'DEBIT',
  parentUuid: '', 
});

// Filter Opsi Parent
const parentOptions = computed(() => {
  if (!props.availableAccounts) return [];
  
  return props.availableAccounts.filter(acc => {
    const isSameCategory = acc.category === form.value.category;
    const isNotSelf = isEdit.value ? acc.uuid !== props.accountData?.uuid : true;
    return isSameCategory && isNotSelf;
  });
});

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      if (props.accountData) {
        isEdit.value = true;
        form.value = { 
          ...props.accountData,
          parentUuid: props.accountData.parentUuid || '' 
        };
      } else {
        isEdit.value = false;
        form.value = {
          code: '',
          name: '',
          // Default ke kategori pertama jika ada, atau 'ASSET'
          category: props.categories?.[0]?.value || 'ASSET',
          normalBalance: 'DEBIT',
          parentUuid: '',
        };
      }
    }
  }
);

watch(() => form.value.category, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    form.value.parentUuid = '';
  }
});

const closeModal = () => {
  emit('close');
};

const onSubmit = async () => {
  try {
    isLoading.value = true;
    
    const payload = {
      ...form.value,
      parentUuid: form.value.parentUuid === '' ? null : form.value.parentUuid
    };

    if (isEdit.value && props.accountData?.uuid) {
      await update(props.accountData.uuid, payload);
    } else {
      await create(payload);
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
        <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4 text-center">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95 translate-y-4"
            enter-to="opacity-100 scale-100 translate-y-0"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100 translate-y-0"
            leave-to="opacity-0 scale-95 translate-y-4"
          >
            <DialogPanel
              class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all"
            >
              <div class="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <DialogTitle as="h3" class="text-lg font-bold leading-6 text-gray-900">
                  {{ isEdit ? 'Edit Akun' : 'Tambah Akun Baru' }}
                </DialogTitle>
                <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition-colors">
                  <i class="pi pi-times"></i>
                </button>
              </div>

              <div class="px-6 py-6">
                <form @submit.prevent="onSubmit" class="space-y-5">
                  
                  <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Kategori</label>
                    <div class="relative">
                      <select
                        v-model="form.category"
                        class="block w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
                      >
                        <option 
                          v-for="cat in categories" 
                          :key="cat.value" 
                          :value="cat.value"
                        >
                          {{ cat.label }}
                        </option>
                      </select>
                      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                        <i class="pi pi-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Induk Akun <span class="text-gray-400 font-normal normal-case">(Opsional)</span>
                    </label>
                    <div class="relative">
                      <select
                        v-model="form.parentUuid"
                        class="block w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-700 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
                      >
                        <option value="">- Akun Utama (Root) -</option>
                        <option v-for="parent in parentOptions" :key="parent.uuid" :value="parent.uuid">
                          {{ parent.code }} - {{ parent.name }}
                        </option>
                      </select>
                      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                        <i class="pi pi-chevron-down text-xs"></i>
                      </div>
                    </div>
                    <p class="mt-1.5 text-[10px] text-gray-400">Pilih akun induk jika ingin membuat sub-akun (nested).</p>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div class="col-span-1">
                      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Kode</label>
                      <input
                        v-model="form.code"
                        type="text"
                        required
                        class="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm font-mono transition-all"
                        placeholder="1-001"
                      />
                    </div>

                    <div class="col-span-2">
                      <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama Akun</label>
                      <input
                        v-model="form.name"
                        type="text"
                        required
                        class="block w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
                        placeholder="Contoh: Kas Besar"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Saldo Normal</label>
                    <div class="flex gap-4">
                      <label class="flex-1 relative cursor-pointer group">
                        <input type="radio" v-model="form.normalBalance" value="DEBIT" class="peer sr-only">
                        <div class="p-3 rounded-xl border-2 border-gray-100 text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all">
                          <span class="block text-sm font-bold text-gray-600 peer-checked:text-blue-700">Debit</span>
                        </div>
                      </label>
                      <label class="flex-1 relative cursor-pointer group">
                        <input type="radio" v-model="form.normalBalance" value="CREDIT" class="peer sr-only">
                        <div class="p-3 rounded-xl border-2 border-gray-100 text-center peer-checked:border-emerald-500 peer-checked:bg-emerald-50 transition-all">
                          <span class="block text-sm font-bold text-gray-600 peer-checked:text-emerald-700">Kredit</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div class="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      class="inline-flex justify-center rounded-xl border border-transparent bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none border-gray-200 transition-all"
                      @click="closeModal"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      class="inline-flex justify-center rounded-xl border border-transparent bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none shadow-lg shadow-gray-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      :disabled="isLoading"
                    >
                      <i v-if="isLoading" class="pi pi-spin pi-spinner mr-2"></i>
                      {{ isLoading ? 'Menyimpan...' : 'Simpan Akun' }}
                    </button>
                  </div>
                </form>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>