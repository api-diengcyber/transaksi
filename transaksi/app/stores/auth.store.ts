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
    // Getter untuk meratakan struktur toko (Parent + Cabang)
    flatStores: (state) => {
      const allStores = new Map();

      const traverse = (items: any[], parent: any = null) => {
        if (!items || !Array.isArray(items)) return;

        items.forEach(store => {
          const enrichedStore = { ...store };

          // Logika penanda Cabang vs Pusat
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

          // Rekursif untuk mengambil cabang di dalamnya
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

        // [PERBAIKAN WAJIB]: Tambahkan opsi path: '/' agar cookie dibaca dari root
        const cookieOptions = { path: '/', maxAge: 60 * 60 * 24 * 7 }; // Simpan 7 hari
        const storeCookie = useCookie('selectedStoreId', cookieOptions);
        
        let foundStore = null;

        // 1. Coba cari berdasarkan cookie yang tersimpan
        if (storeCookie.value) {
          foundStore = this.flatStores.find((s: any) => s.uuid === storeCookie.value);
        }
        
        // 2. Jika tidak ketemu di cookie, cari yang ditandai isActive dari database
        if (!foundStore) {
          foundStore = this.flatStores.find((s: any) => s.isActive);
        }

        // 3. Fallback terakhir: ambil toko pertama
        if (!foundStore && this.flatStores.length > 0) {
            foundStore = this.flatStores[0];
        }

        this.activeStore = foundStore;
        
        // Sinkronisasi ulang cookie agar path-nya benar ('/')
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
        
        // [PERBAIKAN WAJIB]: Simpan cookie dengan path '/' dan durasi panjang
        const storeCookie = useCookie('selectedStoreId', { 
            path: '/', 
            maxAge: 60 * 60 * 24 * 7 // 7 Hari
        });
        
        storeCookie.value = storeUuid;

        // [PENTING] Hapus reload dari sini karena sudah ditangani di default.vue
        // Biarkan default.vue yang menangani animasi loading lalu reload
      }
    },

    async saveStoreSettings(payload: any) {
      try {
        const response = await useApi('/store/save-setting', { method: 'POST', body: payload });
        
        // Update local state setting agar langsung berubah tanpa refresh
        if (this.activeStore && payload && Array.isArray(payload)) {
             // Konversi array setting payload ke map/object di state jika perlu, 
             // atau trigger fetchUserStores ulang untuk data terbaru
             await this.fetchUserStores(); 
        }
        
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
      // Hapus cookie dengan path yang sama persis
      const storeCookie = useCookie('selectedStoreId', { path: '/' });
      storeCookie.value = null;
    }
  },
  persist: true
});