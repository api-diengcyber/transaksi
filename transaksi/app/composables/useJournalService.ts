// composables/useJournalService.ts

export const useJournalService = () => {
    const config = useRuntimeConfig();
    
    const API_BASE = `${config.public.apiBase}/journal`;
    const DEFAULT_USER_ID = 'user-uuid-123-mock';

    const createSaleTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/sale`, {
            method: 'POST',
            body: {
                ...payload,
                userId: DEFAULT_USER_ID
            }
        });
    };
    
    const createBuyTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/buy`, {
            method: 'POST',
            body: { ...payload, userId: DEFAULT_USER_ID }
        });
    };
    
    const getSalesReport = async () => {
        return await useApi(`${API_BASE}/report/SALE`, {
            method: 'GET'
        });
    };

    const getPurchaseReport = async () => {
        return await useApi(`${API_BASE}/report/BUY`, {
            method: 'GET'
        });
    };
    
    const getChartData = async (startDate: string, endDate: string) => {
        return await useApi(`${API_BASE}/chart`, {
            method: 'GET',
            params: { startDate, endDate }
        });
    };

    return {
        createSaleTransaction,
        createBuyTransaction,
        getSalesReport,
        getPurchaseReport,
        getChartData
    };
};