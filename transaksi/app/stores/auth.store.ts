// stores/auth.store.ts
import { defineStore } from 'pinia';

// Gunakan useApi (yang sudah dibuat sebelumnya) agar request otomatis bawa Token
// Jika belum ada useApi, ganti dengan useNuxtApp().$api atau $fetch dengan header manual
import { useApi } from '~/composables/useApi'; 

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,      // Data User (jika nanti ada endpoint /auth/me)
    stores: [] as any[],    // List semua toko milik user
    activeStore: null as any, // Toko yang sedang aktif (isActive: true)
    isLoggedIn: false,
  }),

  getters: {
    // Helper untuk mengambil setting toko aktif dengan aman
    getSetting: (state) => (key: string, defaultValue: any = null) => {
      return state.activeStore?.settings?.[key] ?? defaultValue;
    }
  },
  
  actions: {
    // 1. Action Fetch Data Toko dari Backend
    async fetchUserStores() {
      try {
        // Panggil endpoint GET /store/my-store
        const response = await useApi('/store/my-store', { method: 'GET' }) as any[];
        
        // Simpan ke State
        this.stores = response;

        // Cari toko yang isActive: true
        this.activeStore = this.stores.find((s: any) => s.isActive) || null;
        
        // (Opsional) Jika tidak ada yang active, set yang pertama
        if (!this.activeStore && this.stores.length > 0) {
            this.activeStore = this.stores[0];
        }
        
        return this.activeStore;
      } catch (error) {
        console.error('Gagal mengambil data toko:', error);
        throw error;
      }
    },

    // 2. Set Auth Data (Dipanggil manual jika punya data user)
    setUserData(user: any) {
      this.user = user;
      this.isLoggedIn = true;
    },

    // 3. Clear Data (Logout)
    clearAuthData() {
      this.user = null;
      this.stores = [];
      this.activeStore = null;
      this.isLoggedIn = false;
    }
  },
  
  // Simpan data ke LocalStorage agar tidak hilang saat refresh
  persist: true
});