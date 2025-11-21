// composables/useProductService.ts

export const useProductService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/product`;

    const getAllProducts = async () => {
        return await useApi(`${API_BASE}/find-all`, { method: 'GET' });
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

    // ... (Sisa method addStock, reduceStock, addPrice, addUnit TETAP SAMA) ...
    // Copy-paste method sub-fitur yang lama di sini
    const addStock = async (uuid: string, qty: number) => {
        return await useApi(`${API_BASE}/add-stok/${uuid}`, {
            method: 'POST',
            body: { qty }
        });
    };

    const reduceStock = async (uuid: string, qty: number) => {
        return await useApi(`${API_BASE}/reduce-stok/${uuid}`, {
            method: 'POST',
            body: { qty }
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

    return {
        getAllProducts,
        getProduct,
        createProduct,
        updateProduct,
        deleteProduct,
        addStock,
        reduceStock,
        addPrice,
        addUnit,
        deleteUnit
    };
};