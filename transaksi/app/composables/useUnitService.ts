// transaksi/app/composables/useUnitService.ts
export const useUnitService = () => {
    const config = useRuntimeConfig();

    const getAllUnits = async () => {
        // Sesuaikan endpoint API ini dengan endpoint yang ada di backend Anda
        return await useApi('/unit/find-all', {
            method: 'GET'
        });
    };

    const getUnit = async (uuid: string) => {
        return await useApi(`/unit/${uuid}`, { method: 'GET' });
    };

    const createUnit = async (payload: any) => {
        return await useApi('/unit/create', {
            method: 'POST',
            body: payload
        });
    };

    const updateUnit = async (uuid: string, payload: any) => {
        return await useApi(`/unit/update/${uuid}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteUnit = async (uuid: string) => {
        return await useApi(`/unit/delete/${uuid}`, {
            method: 'DELETE'
        });
    };

    return {
        getAllUnits,
        getUnit,
        createUnit,
        updateUnit,
        deleteUnit
    };
};