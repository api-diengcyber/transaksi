export const useBrandService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/brand`;

    const getAllBrands = async () => {
        return await useApi(API_BASE, { method: 'GET' });
    };

    const createBrand = async (payload: any) => {
        return await useApi(API_BASE, { method: 'POST', body: payload });
    };

    const updateBrand = async (uuid: string, payload: any) => {
        return await useApi(`${API_BASE}/${uuid}`, { method: 'PATCH', body: payload });
    };

    const deleteBrand = async (uuid: string) => {
        return await useApi(`${API_BASE}/${uuid}`, { method: 'DELETE' });
    };

    return { getAllBrands, createBrand, updateBrand, deleteBrand };
};