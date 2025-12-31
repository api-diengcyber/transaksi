<script setup>
// Tidak perlu import jika auto-import aktif. 
// Jika error, uncomment baris bawah:
// import ConfirmDialog from 'primevue/confirmdialog';
// import Toast from 'primevue/toast';
</script>

<template>
  <div>
    <ConfirmDialog />
    <Toast />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>