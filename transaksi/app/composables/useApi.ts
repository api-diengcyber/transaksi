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
        // 3. Logic Refresh Token (sama seperti sebelumnya, tapi endpoint refresh backend sudah tidak butuh storeUuid)
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

                // Update header dengan token baru (header x-store-id tetap ada)
                headers.Authorization = `Bearer ${newTokens.accessToken}`;

                return await $fetch(url, {
                    baseURL: API_BASE,
                    ...options,
                    headers
                });

            } catch (refreshError) {
                console.error('Session expired');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('selectedStoreId');
                navigateTo('/login');
                throw refreshError;
            }
        }
        throw error;
    }
};