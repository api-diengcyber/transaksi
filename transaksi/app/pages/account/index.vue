<template>
  <div class="py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <h1 class="text-2xl font-semibold text-gray-900">Manajemen Akun</h1>
      <p class="mt-1 text-sm text-gray-500">Atur Chart of Accounts (COA) untuk keperluan akuntansi toko Anda.</p>
    </div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 mt-6">
      <AccountList />
    </div>
  </div>
</template>

<script setup lang="ts">
import AccountList from '~/components/account/AccountList.vue';

definePageMeta({
  layout: 'default'
});
</script>