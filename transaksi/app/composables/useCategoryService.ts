export const useCategoryService = () => {
    const config = useRuntimeConfig();
    // Sesuaikan BASE_URL dengan alamat backend NestJS kamu (misal: http://localhost:3000)
    const API_URL = config.public.apiBaseUrl || 'http://localhost:3000';

    const getAllCategorys = async () => {
        return await useApi('/category/find-all');
    };

    const getCategory = async (uuid: string) => {
        return await useApi(`/category/${uuid}`);
    };

    const createCategory = async (payload: any) => {
        return await useApi('/category/create', {
            method: 'POST',
            body: payload
        });
    };

    const updateCategory = async (uuid: string, payload: any) => {
        return await useApi(`/category/update/${uuid}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteCategory = async (uuid: string) => {
        return await useApi(`/category/delete/${uuid}`, {
            method: 'DELETE'
        });
    };

    return {
        getAllCategorys,
        getCategory,
        createCategory,
        updateCategory,
        deleteCategory
    };
};