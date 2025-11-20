export const useStoreService = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase || 'http://localhost:3000'; 

    const getMyStore = async () => {
        return await useApi('/store/my-store', {
            method: 'GET'
        });
    };

    const saveStoreSettings = async (payload: any) => {
        return await useApi('/store/save-setting', {
            method: 'POST',
            body: payload
        });
    };

    return {
        getMyStore,
        saveStoreSettings
    };
};