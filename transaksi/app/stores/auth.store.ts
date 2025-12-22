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

        const storesList = Array.isArray(data) ? data : [data];
        this.stores = storesList;

        // [BARU] Logika prioritas pemilihan toko:
        // 1. Cek Cookie 'selectedStoreId'
        // 2. Cek property 'isActive' dari backend (jika ada)
        // 3. Fallback ke toko pertama di list
        const storeCookie = useCookie('selectedStoreId');
        
        if (storeCookie.value) {
            this.activeStore = this.stores.find((s: any) => s.uuid === storeCookie.value) || this.stores[0];
        } else {
            this.activeStore = this.stores.find((s: any) => s.isActive) || this.stores[0] || null;
        }

        // Sinkronisasi cookie jika activeStore sudah ketemu
        if (this.activeStore) {
            storeCookie.value = this.activeStore.uuid;
        }
        
        return this.activeStore;
      } catch (error) {
        console.error('Gagal mengambil data toko:', error);
        throw error;
      }
    },

    // [BARU] Action untuk ganti toko
    async switchStore(storeUuid: string) {
        const targetStore = this.stores.find(s => s.uuid === storeUuid);
        
        if (targetStore) {
            this.activeStore = targetStore;
            
            // Simpan ke cookie agar useApi bisa membacanya dan mengirim header x-store-id
            const storeCookie = useCookie('selectedStoreId');
            storeCookie.value = storeUuid;
            
            // Reload halaman agar semua data di-fetch ulang dengan konteks toko baru
            if (import.meta.client) {
                window.location.reload();
            }
        }
    },

    async saveStoreSettings(payload: any) {
      try {
        const response = await useApi('/store/save-setting', {
            method: 'POST',
            body: payload
        });

        // Optimistic Update
        if (this.activeStore) {
            this.activeStore.name = payload.name;
            this.activeStore.address = payload.address;
            this.activeStore.phone = payload.phone;
            this.activeStore.email = payload.email;

            if (!this.activeStore.settings) this.activeStore.settings = [];
            
            if (Array.isArray(payload.settings)) {
                payload.settings.forEach((newItem: any) => {
                    if (Array.isArray(this.activeStore.settings)) {
                        const existingIdx = this.activeStore.settings.findIndex((s: any) => s.key === newItem.key);
                        if (existingIdx !== -1) {
                            this.activeStore.settings[existingIdx].value = newItem.value;
                        } else {
                            this.activeStore.settings.push(newItem);
                        }
                    }
                });
            }
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
      const storeCookie = useCookie('selectedStoreId');
      storeCookie.value = null;
    }
  },
  persist: true 
});