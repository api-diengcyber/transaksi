export const useBankService = () => {
  const config = useRuntimeConfig();
  const API_BASE = config.public.apiBase;

  const getAll = async () => {
    return await useApi(`${API_BASE}/bank/get-all`, { method: 'GET' });
  };

  const create = async (data: any) => {
    return await useApi(`${API_BASE}/bank/create`, { method: 'POST', body: data });
  };

  const update = async (id: string, data: any) => {
    return await useApi(`${API_BASE}/bank/update/${id}`, { method: 'PUT', body: data });
  };

  const remove = async (id: string) => {
    return await useApi(`${API_BASE}/bank/remove/${id}`, { method: 'DELETE' });
  };

  return { 
    getAll, 
    create, 
    update,
    remove 
  };
};