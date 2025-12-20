export const useStoreService = () => {
    const config = useRuntimeConfig();
    const API_BASE = config.public.apiBase;

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

    const uploadStoreLogo = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return await useApi(`/store/upload-logo`, {
            method: 'POST',
            body: formData,
        });
    }

    const createStore = async (payload: any) => {
        return await useApi('/store/create', {
            method: 'POST',
            body: payload
        });
    };

    const createBranch = async (payload: any) => {
        return await useApi('/store/branch', {
            method: 'POST',
            body: payload
        });
    };

    const getBranches = async () => {
        return await useApi('/store/branch-tree', {
            method: 'GET'
        });
    };

    return {
        getMyStore,
        saveStoreSettings,
        uploadStoreLogo,
        createStore,
        createBranch,
        getBranches,
    };
};