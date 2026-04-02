// transaksi/app/composables/usePriceGroupService.ts
export const usePriceGroupService = () => {
    
    const getAllPriceGroups = async () => {
        // Sesuaikan endpoint API ini dengan backend Anda
        return await useApi('/price-group/find-all', {
            method: 'GET'
        });
    };

    const createPriceGroup = async (payload: any) => {
        return await useApi('/price-group/create', {
            method: 'POST',
            body: payload
        });
    };

    const updatePriceGroup = async (uuid: string, payload: any) => {
        return await useApi(`/price-group/update/${uuid}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deletePriceGroup = async (uuid: string) => {
        return await useApi(`/price-group/delete/${uuid}`, {
            method: 'DELETE'
        });
    };

    return {
        getAllPriceGroups,
        createPriceGroup,
        updatePriceGroup,
        deletePriceGroup
    };
};