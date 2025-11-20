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
        // URL yang benar sesuai controller
        const response = await useApi('/store/my-store', { method: 'GET' });
        
        let data = response;
        if (response && (response as any).data) data = (response as any).data;

        const storesList = Array.isArray(data) ? data : [data];
        this.stores = storesList;
        this.activeStore = this.stores.find((s: any) => s.isActive) || this.stores[0] || null;
        
        return this.activeStore;
      } catch (error) {
        console.error('Gagal mengambil data toko:', error);
        throw error;
      }
    },

    async saveStoreSettings(payload: any) {
      try {
        // [FIXED] URL diperbaiki dari '/my-store/save-setting' menjadi '/store/save-setting'
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
                    // Jika settings di state object, convert atau handle array
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
    }
  },
  persist: true 
});