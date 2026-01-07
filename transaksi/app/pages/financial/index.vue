<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '#imports'

// Import komponen
import AccountList from '~/components/account/AccountList.vue'
import JournalGeneralTab from '~/components/journal/JournalGeneralTab.vue'
import JournalSettingTab from '~/components/journal/JournalSettingTab.vue' // Tambahkan import ini

// Judul Halaman
useHead({
  title: 'Keuangan (Finance)',
})

// State untuk Tab Aktif
const activeTab = ref('account')

// Daftar Tab (Ditambah data ikon path untuk SVG)
const tabs = [
  { 
    id: 'account', 
    label: 'Daftar Akun',
    // Icon: List / Clipboard
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' 
  },
  { 
    id: 'journal', 
    label: 'Jurnal Umum',
    // Icon: Book / Document
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' 
  },
  { 
    id: 'setting', 
    label: 'Pengaturan Mapping',
    // Icon: Cog / Settings
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
  },
]
</script>

<template>
  <div class="flex flex-col h-full bg-surface-50 p-6 min-h-screen">
    
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold tracking-tight">Keuangan</h1>
      <p class="mt-2 text-sm text-gray-400">
        Kelola Chart of Accounts (COA), Jurnal Umum, dan konfigurasi pemetaan otomatis.
      </p>
    </div>

    <div class="bg-surface-0 rounded-xl shadow-sm border border-surface-200 overflow-hidden flex flex-col flex-1">
      
      <div class="border-b border-gray-200 bg-surface-0">
        <nav class="flex space-x-8 px-6" aria-label="Tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ease-in-out focus:outline-none"
            :class="[
              activeTab === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <svg 
              class="mr-2.5 h-5 w-5 transition-colors duration-300"
              :class="activeTab === tab.id ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.iconPath" />
            </svg>
            
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <div class="p-6 flex-1 bg-surface-0 overflow-auto relative">
        <Transition name="fade" mode="out-in">
          
          <div v-if="activeTab === 'account'" key="account" class="h-full">
            <AccountList />
          </div>

          <div v-else-if="activeTab === 'journal'" key="journal" class="h-full">
            <JournalGeneralTab />
          </div>

          <div v-else-if="activeTab === 'setting'" key="setting" class="h-full">
            <JournalSettingTab />
          </div>

        </Transition>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Custom Transition untuk Tab Switching */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>