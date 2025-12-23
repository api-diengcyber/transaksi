export const useCourierService = () => {

  const getCouriers = async () => {
    return await useApi('/courier', { method: 'GET' });
  };

  const createCourier = async (name: string) => {
    return await useApi('/courier', { method: 'POST', body: { name } });
  };

  const deleteCourier = async (id: string) => {
    return await useApi(`/courier/${id}`, { method: 'DELETE' });
  };

  return { 
    getCouriers, 
    createCourier, 
    deleteCourier
  };
};