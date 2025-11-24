// transaksi/app/composables/useTableService.ts
export const useTableService = () => {
    // Diasumsikan API_BASE dimuat dari runtime config
    const API_BASE = useRuntimeConfig().public.apiBase; 

    const getAllTables = async () => {
        return await useApi('/table/find-all');
    };

    const getTable = async (uuid: string) => {
        return await useApi(`/table/${uuid}`);
    };

    const createTable = async (payload: { name: string; capacity: number }) => {
        return await useApi('/table/create', {
            method: 'POST',
            body: payload
        });
    };

    const updateTable = async (uuid: string, payload: { name?: string; capacity?: number }) => {
        return await useApi(`/table/update/${uuid}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteTable = async (uuid: string) => {
        return await useApi(`/table/delete/${uuid}`, {
            method: 'DELETE'
        });
    };

    return {
        getAllTables,
        getTable,
        createTable,
        updateTable,
        deleteTable,
    };
};