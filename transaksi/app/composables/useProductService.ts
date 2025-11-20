// composables/useProductService.ts

export const useProductService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/product`;
    const DEFAULT_USER_ID = 'user-uuid-123-mock';

    const getAllProducts = async () => {
        return await useApi(`${API_BASE}/find-all`, { method: 'GET' });
    };

    const getProduct = async (uuid: string) => {
        return await useApi(`${API_BASE}/${uuid}`, { method: 'GET' });
    };

    const createProduct = async (payload: any) => {
        return await useApi(`${API_BASE}/create`, {
            method: 'POST',
            body: { ...payload, userId: DEFAULT_USER_ID }
        });
    };

    const updateProduct = async (uuid: string, name: string) => {
        return await useApi(`${API_BASE}/update/${uuid}`, {
            method: 'PUT',
            body: { name, userId: DEFAULT_USER_ID }
        });
    };

    const deleteProduct = async (uuid: string) => {
        return await useApi(`${API_BASE}/delete/${uuid}`, {
            method: 'DELETE',
            body: { userId: DEFAULT_USER_ID }
        });
    };

    // ... (Sisa method addStock, reduceStock, addPrice, addUnit TETAP SAMA) ...
    // Copy-paste method sub-fitur yang lama di sini
    const addStock = async (uuid: string, qty: number) => {
        return await useApi(`${API_BASE}/add-stok/${uuid}`, {
            method: 'POST',
            body: { qty, userId: DEFAULT_USER_ID }
        });
    };

    const reduceStock = async (uuid: string, qty: number) => {
        return await useApi(`${API_BASE}/reduce-stok/${uuid}`, {
            method: 'POST',
            body: { qty, userId: DEFAULT_USER_ID }
        });
    };

    const addPrice = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/add-price/${uuid}`, {
            method: 'POST',
            body: { ...payload, userId: DEFAULT_USER_ID }
        });
    };
    
    const addUnit = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/add-unit/${uuid}`, {
            method: 'POST',
            body: { ...payload, userId: DEFAULT_USER_ID }
        });
    };
    
    const deleteUnit = async (unitUuid: string) => {
        return await useApi(`${API_BASE}/delete-unit/${unitUuid}`, {
            method: 'DELETE',
            body: { userId: DEFAULT_USER_ID }
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