export const useProductService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/product`;

    const getAllProducts = async (page: number = 1, limit: number = 10, search: string = '') => {
        const params: any = {
            page: page,
            limit: limit,
        };
        if (search) {
            params.search = search;
        }
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

    return {
        getAllProducts,
        getProduct,
        createProduct,
        updateProduct,
        deleteProduct,
    };
};