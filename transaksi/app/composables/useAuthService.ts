// composables/useAuthService.ts
import { useAuthStore } from '~/stores/auth.store';
import { useRouter } from 'vue-router';

export const useAuthService = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;
    
    const authStore = useAuthStore();
    const router = useRouter();

    // --- [BARU] Fungsi untuk mengambil profil user aktif ---
    const fetchMe = async () => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) return null;

        try {
            const response = await $fetch(`${API_BASE}/auth/me`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` }
            }) as any;

            // Sesuaikan dengan struktur response dari backend (misal response.data atau langsung response)
            const userData = response?.data || response;
            
            // Simpan data user ke dalam store Pinia
            authStore.user = userData;
            authStore.isLoggedIn = true;

            return userData;
        } catch (error) {
            console.error('Gagal mengambil data profil:', error);
            // Opsional: Jika token expired/invalid, bersihkan state
            // authStore.clearAuthData();
            // localStorage.removeItem('accessToken');
            return null;
        }
    };

    const login = async (credentials: any) => {
        // 1. Panggil Login (Dapat Token Saja)
        const response = await $fetch(`${API_BASE}/auth/signin`, {
            method: 'POST',
            body: credentials
        }) as any;

        // 2. Simpan Token ke Local
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('refreshToken', response.refreshToken);

        // Memberikan jeda singkat memastikan token tertulis ke disk
        await new Promise(resolve => setTimeout(resolve, 400));

        // 3. [BARU] Ambil profil user (/auth/me) menggunakan token yang baru disave
        await fetchMe();

        // 4. Fetch & Simpan Data Toko ke Pinia
        await authStore.fetchUserStores();

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
            // Bersihkan Local Storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('selectedStoreId');
            
            // Bersihkan Pinia
            authStore.clearAuthData(); 
            
            router.push('/login');
        }
    };

    // Export fetchMe agar bisa dipanggil di tempat lain (contoh: saat reload halaman)
    return { login, logout, fetchMe };
};