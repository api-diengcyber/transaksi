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

    const getWarehouseStock = async (uuid: string) => {
        return await useApi(`/warehouse/${uuid}/stock`, { method: 'GET' });
    };
    
    const getWarehouseHistory = async (uuid: string) => {
        return await useApi(`/journal/warehouse/${uuid}/history`, {
            method: 'GET'
        });
    };

    return {
        getAllWarehouses,
        createWarehouse,
        getWarehouseStock,
        getWarehouseHistory
    };
};