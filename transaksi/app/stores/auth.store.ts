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
    // [PERBAIKAN UTAMA DI SINI]
    flatStores: (state) => {
      const allStores = new Map();

      // Tambahkan parameter 'parent' untuk meneruskan info induk ke anak
      const traverse = (items: any[], parent: any = null) => {
        if (!items || !Array.isArray(items)) return;

        items.forEach(store => {
          // Clone object agar tidak mengubah state asli secara langsung
          const enrichedStore = { ...store };

          // Jika sedang memproses anak (punya parent), tandai sebagai CABANG
          if (parent) {
            enrichedStore.parentId = parent.uuid;
            enrichedStore.storeType = 'CABANG';
            enrichedStore.description = `Cabang dari ${parent.name}`;
          } else {
            // Jika tidak punya parent, tandai sebagai PUSAT (kecuali backend bilang lain)
            if (!enrichedStore.storeType) enrichedStore.storeType = 'PUSAT';
          }

          if (!allStores.has(enrichedStore.uuid)) {
            allStores.set(enrichedStore.uuid, enrichedStore);
          }

          // Rekursif ke anak-anaknya
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

        // Logic Active Store (tetap sama)
        const storeCookie = useCookie('selectedStoreId');
        if (storeCookie.value) {
          this.activeStore = this.flatStores.find((s: any) => s.uuid === storeCookie.value);
        }
        if (!this.activeStore) {
          this.activeStore = this.flatStores.find((s: any) => s.isActive) || this.flatStores[0];
        }
        if (this.activeStore) {
          storeCookie.value = this.activeStore.uuid;
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
        const storeCookie = useCookie('selectedStoreId');
        storeCookie.value = storeUuid;
        if (import.meta.client) window.location.reload();
      }
    },

    async saveStoreSettings(payload: any) {
      try {
        const response = await useApi('/store/save-setting', { method: 'POST', body: payload });
        // Optimistic update logic...
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
      const storeCookie = useCookie('selectedStoreId');
      storeCookie.value = null;
    }
  },
  persist: true
});