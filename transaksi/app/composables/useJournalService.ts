// composables/useJournalService.ts

export const useJournalService = () => {
    const config = useRuntimeConfig();
    
    // Pastikan base URL sesuai dengan konfigurasi public di nuxt.config.ts
    const API_BASE = `${config.public.apiBase}/journal`;

    // --- TRANSAKSI UTAMA (SALE & BUY) ---
    
    // Menangani Penjualan (termasuk penjualan antar cabang jika ada target_store_uuid di payload)
    const createSaleTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/sale`, {
            method: 'POST',
            body: payload
        });
    };
    
    // Menangani Pembelian (termasuk pembelian otomatis dari cabang lain)
    const createBuyTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/buy`, {
            method: 'POST',
            body: payload
        });
    };
    
    // --- TRANSAKSI RETUR ---

    const createSaleReturnTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return/sale`, {
            method: 'POST',
            body: payload
        });
    };

    const createBuyReturnTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/return/buy`, {
            method: 'POST',
            body: payload
        });
    };
    
    // --- PIUTANG/HUTANG GLOBAL (KEUANGAN) ---

    // Mencatat Piutang Awal (Saldo Awal / Pinjaman Karyawan dll)
    const createArTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/debt/ar`, {
            method: 'POST',
            body: payload
        });
    };
    
    // Mencatat Hutang Awal (Saldo Awal / Pinjaman Modal dll)
    const createApTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/debt/ap`, {
            method: 'POST',
            body: payload
        });
    };

    // --- PEMBAYARAN PIUTANG/HUTANG ---

    // Pelunasan Piutang (Terima Uang)
    const createArPaymentTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/payment/ar`, {
            method: 'POST',
            body: payload
        });
    };
    
    // Pelunasan Hutang (Keluar Uang)
    const createApPaymentTransaction = async (payload: any) => {
        return await useApi(`${API_BASE}/payment/ap`, {
            method: 'POST',
            body: payload
        });
    };

    // --- LAPORAN/REPORTING ---
    
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
        return await useApi(`${API_BASE}/chart`, {
            method: 'GET',
            params: { startDate, endDate }
        });
    };

    return {
        createSaleTransaction,
        createBuyTransaction,
        createSaleReturnTransaction,
        createBuyReturnTransaction,
        createArTransaction, 
        createApTransaction, 
        createArPaymentTransaction, 
        createApPaymentTransaction, 
        getSalesReport,
        getPurchaseReport,
        getChartData,
        findAllByType
    };
};