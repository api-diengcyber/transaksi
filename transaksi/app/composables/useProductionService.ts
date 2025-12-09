export const useProductionService = () => {

    // --- PRODUKSI UTAMA ---

    const getAllOrders = async () => {
        // GET /production
        return await useApi('/production');
    };

    const getProductionDetail = async (uuid: string) => {
        // GET /production/:uuid
        // Harap pastikan backend melakukan load relation 'flows'
        return await useApi(`/production/${uuid}`);
    };

    const createOrder = async (payload: any) => {
        return await useApi('/production', {
            method: 'POST',
            body: payload
        });
    };

    const updateOrder = async (uuid: string, payload: any) => {
        return await useApi(`/production/${uuid}`, {
            method: 'PATCH',
            body: payload
        });
    };

    // --- MANAJEMEN FLOW ---

    // Asumsi: Backend memiliki Controller/Route untuk 'production-flow'
    // Jika belum ada, Anda harus membuatnya di Backend NestJS.
    const getFlowsByProduction = async (productionUuid: string) => {
        // Sesuai endpoint di controller: GET /production-flow/by-production/:uuid
        return await useApi(`/production-flow/by-production/${productionUuid}`);
    };

    const createFlow = async (payload: any) => {
        // payload: { productionUuid, stepName, stepOrder, pic, ... }
        return await useApi('/production-flow', {
            method: 'POST',
            body: payload
        });
    };

    const updateFlow = async (uuid: string, payload: any) => {
        return await useApi(`/production-flow/${uuid}`, {
            method: 'PATCH',
            body: payload
        });
    };

    const deleteFlow = async (uuid: string) => {
        return await useApi(`/production-flow/${uuid}`, {
            method: 'DELETE'
        });
    };

    // Fungsi khusus lain (Setoran, dll)
    const submitSetoran = async (payload: any) => {
        return await useApi('/journal/production/setoran', {
            method: 'POST',
            body: {
                details: payload
            }
        });
    };

    return {
        getAllOrders,
        getProductionDetail,
        createOrder,
        updateOrder,
        getFlowsByProduction,
        createFlow,
        updateFlow,
        deleteFlow,
        submitSetoran
    };
};