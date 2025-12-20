// app/composables/useApi.ts

export const useApi = async (url: string, options: any = {}) => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;
    
    const accessToken = useCookie('accessToken');
    const refreshToken = useCookie('refreshToken');
    
    // [BARU] Ambil Store ID dari cookie terpisah
    const selectedStoreId = useCookie('selectedStoreId'); 

    // 1. Definisikan Header
    const headers: any = {
        ...options.headers,
        Authorization: accessToken.value ? `Bearer ${accessToken.value}` : ''
    };

    // [BARU] Inject Header Store ID jika ada
    if (selectedStoreId.value) {
        headers['x-store-id'] = selectedStoreId.value;
    }

    try {
        // 2. Request Pertama
        return await $fetch(url, {
            baseURL: API_BASE,
            ...options,
            headers
        });
    } catch (error: any) {
        // 3. Logic Refresh Token (sama seperti sebelumnya, tapi endpoint refresh backend sudah tidak butuh storeUuid)
        if (error.response?.status === 401 && refreshToken.value) {
            try {
                const newTokens: any = await $fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${refreshToken.value}`
                    }
                });

                accessToken.value = newTokens.accessToken;
                refreshToken.value = newTokens.refreshToken;

                // Update header dengan token baru (header x-store-id tetap ada)
                headers.Authorization = `Bearer ${newTokens.accessToken}`;

                return await $fetch(url, {
                    baseURL: API_BASE,
                    ...options,
                    headers
                });

            } catch (refreshError) {
                console.error('Session expired');
                accessToken.value = null;
                refreshToken.value = null;
                selectedStoreId.value = null; // Clear store juga
                navigateTo('/login');
                throw refreshError;
            }
        }
        throw error;
    }
};