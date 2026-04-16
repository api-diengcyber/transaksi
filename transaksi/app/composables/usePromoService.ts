import { useApi } from './useApi';

export const usePromoService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/promo`;
    
    const getPromos = async () => await useApi(
        `${API_BASE}`,
        {
            method: 'GET',
        }
    );
    const getPromo = async (uuid: string) => await useApi(
        `${API_BASE}/${uuid}`,
        {
            method: 'GET',
        }
    );
    const createPromo = async (data: any) => await useApi(
        `${API_BASE}`,
        {
            method: 'POST',
            body: data,
        }
    );
    const updatePromo = async (uuid: string, data: any) => await useApi(
        `${API_BASE}/${uuid}`,
        {
            method: 'PATCH',
            body: data,
        }
    );
    const deletePromo = async (uuid: string) => await useApi(
        `${API_BASE}/${uuid}`,
        {
            method: 'DELETE',
        }
    );

    return { getPromos, getPromo, createPromo, updatePromo, deletePromo };
};