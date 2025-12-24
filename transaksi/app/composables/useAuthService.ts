// composables/useAuthService.ts
import { useAuthStore } from '~/stores/auth.store';

export const useAuthService = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;
    
    const authStore = useAuthStore();
    const router = useRouter();

    const login = async (credentials: any) => {
        // 1. Panggil Login (Dapat Token Saja)
        const response = await $fetch(`${API_BASE}/auth/signin`, {
            method: 'POST',
            body: credentials
        }) as any;

        // 2. Simpan Token ke Local
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);

        await new Promise(resolve => setTimeout(resolve, 400));

        // 3. [BARU] Fetch & Simpan Data Toko ke Pinia
        // Token sudah tersimpan di cookie, jadi request selanjutnya (useApi) akan membawanya.
        await authStore.fetchUserStores();

        // (Opsional) Set User Data dari JWT (decode) atau fetch /auth/me jika ada
        // authStore.setUserData(...) 
        authStore.isLoggedIn = true;

        return response;
    };

    const logout = async () => {
        const accessToken = localStorage.getItem('accessToken') ?? null;
        try {
            if (accessToken) {
                await $fetch(`${API_BASE}/auth/logout`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            }
        } catch (e) {
            console.error('Logout error', e);
        } finally {
            // Bersihkan Cookie
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('selectedStoreId');
            
            // Bersihkan Pinia
            authStore.clearAuthData(); 
            
            navigateTo('/login');
        }
    };

    return { login, logout };
};