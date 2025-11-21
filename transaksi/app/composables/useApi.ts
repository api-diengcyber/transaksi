// composables/useApi.ts
export const useApi = async (url: string, options: any = {}) => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;
    
    const accessToken = useCookie('accessToken');
    const refreshToken = useCookie('refreshToken');

    // 1. Definisikan Header default (masukkan token jika ada)
    const headers = {
        ...options.headers,
        Authorization: accessToken.value ? `Bearer ${accessToken.value}` : ''
    };

    try {
        // 2. Coba Request Pertama
        return await $fetch(url, {
            baseURL: API_BASE,
            ...options,
            headers
        });
    } catch (error: any) {
        // 3. Jika Error 401 (Unauthorized) & Ada Refresh Token -> Coba Refresh
        if (error.response?.status === 401 && refreshToken.value) {
            try {
                // Panggil Endpoint Refresh Token Backend
                // Perhatikan: Backend Anda butuh Refresh Token di Header "Authorization: Bearer ..." (RtGuard)
                const newTokens: any = await $fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${refreshToken.value}`
                    }
                });

                // 4. Update Cookie dengan Token Baru
                accessToken.value = newTokens.accessToken;
                refreshToken.value = newTokens.refreshToken;

                // 5. Ulangi Request Awal dengan Token Baru
                return await $fetch(url, {
                    baseURL: API_BASE,
                    ...options,
                    headers: {
                        ...options.headers,
                        Authorization: `Bearer ${newTokens.accessToken}`
                    }
                });

            } catch (refreshError) {
                // Jika Refresh Token juga expired/salah -> Logout Paksa
                console.error('Session expired, please login again.');
                accessToken.value = null;
                refreshToken.value = null;
                navigateTo('/login');
                throw refreshError;
            }
        }
        
        // Jika error bukan 401 atau tidak ada refresh token, lempar error aslinya
        throw error;
    }
};