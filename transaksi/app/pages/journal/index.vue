<script setup lang="ts">
import { ref } from 'vue';
import JournalGeneralTab from '~/components/journal/JournalGeneralTab.vue';
import JournalSettingTab from '~/components/journal/JournalSettingTab.vue';

const activeTab = ref(0);
</script>

<template>
    <div class="card p-0 min-h-screen bg-surface-50 transition-colors">
        <div class="p-6 pb-0">
            <h1 class="text-3xl font-bold text-primary-600">Jurnal & Akuntansi</h1>
            <p class="text-surface-600 mt-1 text-sm">
                Pusat kontrol pencatatan transaksi dan konfigurasi chart of accounts.
            </p>
        </div>

        <div class="px-6 mt-6 border-b border-surface-200">
            <div class="flex gap-6">
                <button 
                    @click="activeTab = 0"
                    :class="['pb-3 px-1 text-sm font-bold transition-all border-b-2 outline-none', 
                    activeTab === 0 
                        ? 'border-primary-500 text-primary-600' 
                        : 'border-transparent text-surface-500 hover:text-surface-700']">
                    <i class="pi pi-book mr-2"></i> Jurnal Umum
                </button>
                <button 
                    @click="activeTab = 1"
                    :class="['pb-3 px-1 text-sm font-bold transition-all border-b-2 outline-none', 
                    activeTab === 1 
                        ? 'border-primary-500 text-primary-600' 
                        : 'border-transparent text-surface-500 hover:text-surface-700']">
                    <i class="pi pi-cog mr-2"></i> Pengaturan Mapping
                </button>
            </div>
        </div>

        <div class="bg-surface-50">
            <KeepAlive>
                <JournalGeneralTab v-if="activeTab === 0" />
                <JournalSettingTab v-else-if="activeTab === 1" />
            </KeepAlive>
        </div>
    </div>
</template>