// composables/useCategoryService.ts
export const useCategoryService = () => {

    // UBAH NAMA FUNGSI DI SINI
    const getAllCategories = async () => {
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
        getAllCategories, // PASTIKAN EXPORTNYA JUGA DIUBAH
        getCategory,
        createCategory,
        updateCategory,
        deleteCategory
    };
};