import { useApi } from './useApi';

export const useDashboardService = () => {

    const getSummary = async (storeUuid: string) => {
        return await useApi(`/dashboard/summary?storeUuid=${storeUuid}`, {
            method: 'GET'
        });
    };

    return { getSummary };
};