// composables/useInstallService.ts
export const useInstallService = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase; 

    /**
     * Mengirim data instalasi toko & user sekaligus.
     * Endpoint ini bersifat PUBLIC (tidak butuh token).
     */
    const installStore = async (payload: any, logoFile: File | null = null) => {
        const formData = new FormData();
        
        // 1. Append JSON fields ke FormData
        for (const key in payload) {
             formData.append(key, payload[key]);
        }

        // 2. Append file logo jika ada
        if (logoFile) {
            // 'logo' harus sesuai dengan nama field di controller NestJS
            formData.append('logo', logoFile); 
        }

        return await $fetch(`${API_BASE}/store/install`, {
            method: 'POST',
            body: formData
        });
    };

    return {
        installStore
    };
};