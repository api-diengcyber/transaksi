// composables/useJournalService.ts

export const useJournalService = () => {
    const config = useRuntimeConfig();
    
    // Pastikan base URL sesuai dengan konfigurasi public di nuxt.config.ts
    const API_BASE = `${config.public.apiBase}/journal`;

    // =========================================================================
    // TRANSAKSI UTAMA (SALE, BUY)
    // =========================================================================
    const createSaleTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/sale`, {
            method: 'POST',
            body: { details: payload } 
        });
    };
    
    // Menangani Pembelian
    const createBuyTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/buy`, {
            method: 'POST',
            body: { details: payload }
        });
    };
    
    // =========================================================================
    // TRANSAKSI RETUR
    // =========================================================================

    const createSaleReturnTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return/sale`, {
            method: 'POST',
            body: { details: payload }
        });
    };

    const createBuyReturnTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return/buy`, {
            method: 'POST',
            body: { details: payload }
        });
    };

    const createArTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/ar`, {
            method: 'POST',
            body: { details: payload }
        });
    };

    const createArPaymentTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/ar/payment`, {
            method: 'POST',
            body: { details: payload }
        });
    };
    
    const createApTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/ap`, {
            method: 'POST',
            body: { details: payload }
        });
    };
    
    const createApPaymentTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/ap/payment`, {
            method: 'POST',
            body: { details: payload }
        });
    };

    // =========================================================================
    // LAPORAN/REPORTING (Tidak berubah karena menggunakan GET)
    // =========================================================================
    
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
    
    const findAllByType = async (type: string) => {
        return await useApi(`${API_BASE}/report/${type}`, {
            method: 'GET'
        });
    };
    
    const getChartData = async (startDate: string, endDate: string) => {
        return await useApi(`${API_BASE}/chart-data`, {
            method: 'GET',
            params: { startDate, endDate }
        });
    };
    
    const findAll = async (params: any = {}) => {
        return await useApi(`${API_BASE}/report/ALL`, { params }); 
    };

    // =========================================================================
    // MUTASI STOK MANUAL
    // =========================================================================
    const createStockMutation = async (payload: any) => {
        return await useApi(`${API_BASE}/stock-mutation`, {
            method: 'POST',
            body: payload
        });
    };

    return {
        createSaleTransaction,
        createBuyTransaction,
        createSaleReturnTransaction,
        createBuyReturnTransaction,
        createArTransaction, 
        createArPaymentTransaction,
        createApTransaction,  
        createApPaymentTransaction, 
        getSalesReport,
        getPurchaseReport,
        getChartData,
        findAllByType,
        findAll,
        createStockMutation,
    };
};