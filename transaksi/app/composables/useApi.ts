// app/composables/useApi.ts

export const useApi = async (url: string, options: any = {}) => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;

    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    const selectedStoreId = typeof window !== 'undefined' ? localStorage.getItem('selectedStoreId') : null;

    // 1. Definisikan Header
    const headers: any = {
        ...options.headers,
        Authorization: accessToken ? `Bearer ${accessToken}` : ''
    };

    // [BARU] Inject Header Store ID jika ada
    if (selectedStoreId) {
        headers['x-store-id'] = selectedStoreId;
    }

    try {
        // 2. Request Pertama
        return await $fetch(url, {
            baseURL: API_BASE,
            ...options,
            headers
        });
    } catch (error: any) {
        // 3. Logic Refresh Token (Jika 401 Unauthorized)
        if (error.response?.status === 401 && refreshToken) {
            try {
                const newTokens: any = await $fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${refreshToken}`
                    }
                });

                localStorage.setItem('accessToken', newTokens.accessToken);
                localStorage.setItem('refreshToken', newTokens.refreshToken);

                // Update header dengan token baru
                headers.Authorization = `Bearer ${newTokens.accessToken}`;

                return await $fetch(url, {
                    baseURL: API_BASE,
                    ...options,
                    headers
                });

            } catch (refreshError) {
                console.error('Session expired during refresh');
                forceLogout();
                throw refreshError;
            }
        }

        // 4. [BARU] Logic Jika 404 Not Found atau 403 Forbidden (Bisa diatur sesuai kebutuhan backend)
        // Kadang backend mengembalikan 404 jika user/toko sudah dihapus dari database tapi token masih valid
        if (error.response?.status === 404 || error.response?.status === 403) {
            console.error('Resource not found or access denied. Forcing logout.');
            forceLogout();
        }

        throw error;
    }
};

// Fungsi helper untuk membersihkan sesi dan melempar user ke halaman login
function forceLogout() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('selectedStoreId');
        
        // Opsional: Hapus state pinia persistance jika Anda menggunakannya
        localStorage.removeItem('auth'); // Default key dari pinia-plugin-persistedstate
    }

    // Gunakan navigateTo bawaan Nuxt untuk redirect
    navigateTo('/login');
}