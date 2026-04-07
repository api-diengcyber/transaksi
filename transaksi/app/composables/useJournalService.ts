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

    const createReturnSaleTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return-sale`, {
            method: 'POST',
            body: { details: payload }
        });
    };

    const createReturnBuyTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return-buy`, {
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

    /**
     * Mengambil data laporan Inventori / Stok Gudang
     * @param startDate Format YYYY-MM-DD
     * @param endDate Format YYYY-MM-DD
     */
    const getInventoryReport = async (startDate: string, endDate: string) => {
      return await useApi(`${API_BASE}/report-inventory`, {
        method: 'GET',
        params: { startDate, endDate }
      });
    };

    const getInventoryChart = async (startDate: string, endDate: string) => {
      return await useApi(`${API_BASE}/report-inventory/chart`, {
        method: 'GET',
        params: { startDate, endDate }
      });
    }

    /**
     * Mengambil data untuk grafik (Chart)
     * @param startDate Format YYYY-MM-DD
     * @param endDate Format YYYY-MM-DD
     */
    const getChartData = async (startDate: string, endDate: string) => {
        return await useApi(`${API_BASE}/chart-data`, {
            method: 'GET',
            params: { startDate, endDate }
        });
    };
    
    const findAll = async (params: any = {}) => {
        return await useApi(`${API_BASE}/report/ALL`, { params }); 
    };

    const breakStock = async (payload: any) => {
        return await useApi(`${API_BASE}/break-stock`, {
            method: 'POST',
            body: payload,
        });
    };
    
    const combineStock = async (payload: any) => {
        return await useApi(`${API_BASE}/combine-stock`, {
            method: 'POST',
            body: payload,
        });
    };

    const getTransactionById = async (uuid: string) => {
        return await useApi(`${API_BASE}/${uuid}`, {
            method: 'GET',
        });
    };

    const createStockMutation = async (payload: any) => {
        return await useApi(`${API_BASE}/mutation`, {
            method: 'POST',
            body: payload,
        });
    };

    const createOpnameDraft = async (payload: any) => {
        return await useApi(`${API_BASE}/opname/draft`, {
            method: 'POST',
            body: payload,
        });
    };

    const getUnverifiedOpnames = async (warehouseUuid: string) => {
        return await useApi(`${API_BASE}/opname/unverified/${warehouseUuid}`, {
            method: 'GET',
        });
    };

    const verifyOpnameJournal = async (journalUuid: string) => {
        return await useApi(`${API_BASE}/opname/verify/${journalUuid}`, {
            method: 'PUT',
        });
    };

    return {
        createSaleTransaction,
        createBuyTransaction,
        createReturnSaleTransaction,
        createReturnBuyTransaction,
        createArTransaction, 
        createArPaymentTransaction,
        createApTransaction,  
        createApPaymentTransaction, 
        getSalesReport,
        getPurchaseReport,
        getInventoryReport,
        getInventoryChart,
        getChartData,
        findAllByType,
        findAll,
        breakStock,
        combineStock,
        getTransactionById,
        createStockMutation,
        createOpnameDraft,
        getUnverifiedOpnames,
        verifyOpnameJournal,
    };
};