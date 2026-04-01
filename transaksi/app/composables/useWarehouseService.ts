export const useWarehouseService = () => {
    // Sesuaikan dengan konfigurasi Nuxt Anda
    const getAllWarehouses = async () => {
        return await useApi('/warehouse/find-all', { method: 'GET' });
    };

    const createWarehouse = async (payload: any) => {
        return await useApi('/warehouse/create', {
            method: 'POST',
            body: payload
        });
    };

    return {
        getAllWarehouses,
        createWarehouse
    };
};