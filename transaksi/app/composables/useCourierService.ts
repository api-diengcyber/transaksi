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

  const getRoutes = async () => {
    return await useApi('/courier/routes', { method: 'GET' });
  };

  const createRoute = async (body: any) => {
    return await useApi('/courier/routes', { method: 'POST', body });
  };

  return {
    getCouriers,
    createCourier,
    deleteCourier,
    getRoutes,
    createRoute
  };
};