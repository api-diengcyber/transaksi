// composables/useCategoryService.ts
export const useCategoryService = () => {
    // Pastikan global config sudah benar, atau hardcode URL untuk test
    const config = useRuntimeConfig();
    const API_URL = config.public.apiBaseUrl || 'http://localhost:3000'; 

    const getAllCategorys = async () => {
        return await useApi('/category/find-all');
    };

    const getCategory = async (uuid: string) => {
        return await useApi(`/category/${uuid}`);
    };

    const createCategory = async (payload: { name: string; parentUuid?: string | null; isRestaurant?: boolean }) => {
        return await useApi('/category/create', {
            method: 'POST',
            body: payload
        });
    };

    const updateCategory = async (uuid: string, payload: { name: string; parentUuid?: string | null; isRestaurant?: boolean }) => {
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