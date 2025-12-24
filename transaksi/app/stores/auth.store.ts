import { defineStore } from 'pinia';
import { useApi } from '~/composables/useApi';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    stores: [] as any[],
    activeStore: null as any,
    isLoggedIn: false,
  }),

  getters: {
    // ... (Getter flatStores dan getSetting tetap sama)
    flatStores: (state) => {
      const allStores = new Map();
      const traverse = (items: any[], parent: any = null) => {
        if (!items || !Array.isArray(items)) return;
        items.forEach(store => {
          const enrichedStore = { ...store };
          if (parent) {
            enrichedStore.parentId = parent.uuid;
            enrichedStore.storeType = 'CABANG';
            enrichedStore.description = `Cabang dari ${parent.name}`;
          } else {
            if (!enrichedStore.storeType) enrichedStore.storeType = 'PUSAT';
          }
          if (!allStores.has(enrichedStore.uuid)) {
            allStores.set(enrichedStore.uuid, enrichedStore);
          }
          if (store.branches && Array.isArray(store.branches)) {
            traverse(store.branches, enrichedStore);
          }
        });
      };
      traverse(state.stores);
      return Array.from(allStores.values());
    },

    getSetting: (state) => (key: string, defaultValue: any = null) => {
      if (!state.activeStore?.settings) return defaultValue;
      if (Array.isArray(state.activeStore.settings)) {
        const setting = state.activeStore.settings.find((s: any) => s.key === key);
        return setting ? setting.value : defaultValue;
      }
      return state.activeStore.settings[key] ?? defaultValue;
    }
  },

  actions: {
    async fetchUserStores() {
      try {
        const response = await useApi('/store/my-store', { method: 'GET' });
        let data = response;
        if (response && (response as any).data) data = (response as any).data;

        this.stores = Array.isArray(data) ? data : [data];

        let foundStore = null;

        // --- PERUBAHAN: Gunakan localStorage ---
        const savedStoreId = localStorage.getItem('selectedStoreId') ?? null;

        // 1. Coba cari berdasarkan localStorage
        if (savedStoreId) {
          foundStore = this.flatStores.find((s: any) => s.uuid === savedStoreId);
        }
        
        // 2. Jika tidak ketemu di storage, cari yang ditandai isActive
        if (!foundStore) {
          foundStore = this.flatStores.find((s: any) => s.isActive);
        }

        // 3. Fallback terakhir: ambil toko pertama
        if (!foundStore && this.flatStores.length > 0) {
            foundStore = this.flatStores[0];
        }

        this.activeStore = foundStore;
        
        // Sinkronisasi ke localStorage
        if (this.activeStore) {
          localStorage.setItem('selectedStoreId', this.activeStore.uuid);
        }

        return this.activeStore;
      } catch (error) {
        console.error('Gagal mengambil data toko:', error);
        throw error;
      }
    },

    async switchStore(storeUuid: string) {
      const targetStore = this.flatStores.find((s: any) => s.uuid === storeUuid);
      
      if (targetStore) {
        this.activeStore = targetStore;
        
        localStorage.setItem('selectedStoreId', storeUuid);
      }
    },

    async saveStoreSettings(payload: any) {
      try {
        const response = await useApi('/store/save-setting', { method: 'POST', body: payload });
        await this.fetchUserStores(); 
        return response;
      } catch (error) {
        console.error('Gagal menyimpan pengaturan:', error);
        throw error;
      }
    },

    setUserData(user: any) {
      this.user = user;
      this.isLoggedIn = true;
    },

    clearAuthData() {
      this.user = null;
      this.stores = [];
      this.activeStore = null;
      this.isLoggedIn = false;
      
      // --- PERUBAHAN: Hapus dari localStorage ---
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('selectedStoreId');
    }
  },
  persist: true // Memastikan state Pinia sendiri tetap tersimpan di localStorage
});