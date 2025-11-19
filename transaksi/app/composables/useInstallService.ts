// composables/useInstallService.ts
export const useInstallService = () => {
    const config = useRuntimeConfig();
    // Ambil URL dari config atau fallback ke localhost
    const API_BASE = config.public.apiBase || 'http://localhost:3000'; 

    /**
     * Mengirim data instalasi toko & user sekaligus.
     * Endpoint ini bersifat PUBLIC (tidak butuh token).
     */
    const installSystem = async (payload: any) => {
        return await $fetch(`${API_BASE}/store/install`, {
            method: 'POST',
            body: payload
        });
    };

    return {
        installSystem
    };
};