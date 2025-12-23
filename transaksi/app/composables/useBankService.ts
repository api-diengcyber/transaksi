export const useBankService = () => {

  const getBanks = async () => {
    return await useApi('/bank', { method: 'GET' });
  };

  const createBank = async (data: any) => {
    return await useApi('/bank', { method: 'POST', body: data });
  };

  const deleteBank = async (id: string) => {
    return await useApi(`/bank/${id}`, { method: 'DELETE' });
  };

  return { 
    getBanks, 
    createBank, 
    deleteBank 
  };
};