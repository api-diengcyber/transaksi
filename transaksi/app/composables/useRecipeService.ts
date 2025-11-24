// transaksi/app/composables/useRecipeService.ts
// Untuk mengelola resep (daftar bahan baku per produk)
export const useRecipeService = () => {
    // Diasumsikan API_BASE dimuat dari runtime config
    const API_BASE = useRuntimeConfig().public.apiBase; 

    // Mendapatkan resep untuk produk tertentu
    const getRecipeByProduct = async (productUuid: string) => {
        return await useApi(`/recipe/${productUuid}`);
    };
    
    // Menyimpan/memperbarui daftar bahan baku
    const saveRecipe = async (productUuid: string, payload: { 
        ingredients: {
            ingredientProductUuid: string; 
            unitUuid: string; 
            qty: number; 
        }[] 
    }) => {
        return await useApi(`/recipe/save/${productUuid}`, {
            method: 'POST',
            body: payload
        });
    };

    return {
        getRecipeByProduct,
        saveRecipe,
    };
};