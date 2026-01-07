export const useProductService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/product`;

    // PERBAIKAN: Tambahkan parameter page, limit, dan search untuk pagination/pencarian
    const getAllProducts = async (page: number = 1, limit: number = 10, search: string = '') => {
        const params: any = {
            page: page,
            limit: limit,
        };

        if (search) {
            params.search = search;
        }

        // useApi akan otomatis mengonversi params menjadi query string (?page=...&limit=...&search=...)
        return await useApi(`${API_BASE}/find-all`, {
            method: 'GET',
            params: params,
        });
    };

    const getProduct = async (uuid: string) => {
        return await useApi(`${API_BASE}/${uuid}`, { method: 'GET' });
    };

    const createProduct = async (payload: any) => {
        return await useApi(`${API_BASE}/create`, {
            method: 'POST',
            body: { ...payload }
        });
    };

    const updateProduct = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/update/${uuid}`, {
            method: 'PUT',
            body: { ...payload }
        });
    };

    const deleteProduct = async (uuid: string) => {
        return await useApi(`${API_BASE}/delete/${uuid}`, {
            method: 'DELETE',
        });
    };

    const addPrice = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/add-price/${uuid}`, {
            method: 'POST',
            body: { ...payload }
        });
    };

    const addUnit = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/add-unit/${uuid}`, {
            method: 'POST',
            body: { ...payload }
        });
    };

    const deleteUnit = async (unitUuid: string) => {
        return await useApi(`${API_BASE}/delete-unit/${unitUuid}`, {
            method: 'DELETE',
        });
    };

    const breakUnit = async (payload: any) => {
        return await useApi(`${API_BASE}/break-unit`, {
            method: 'POST',
            body: { ...payload }
        });
    };

    return {
        getAllProducts,
        getProduct,
        createProduct,
        updateProduct,
        deleteProduct,
        addPrice,
        addUnit,
        deleteUnit,
        breakUnit
    };
};