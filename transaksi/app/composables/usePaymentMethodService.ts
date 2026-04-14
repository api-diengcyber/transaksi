// app/composables/usePaymentMethodService.ts
export const usePaymentMethodService = () => {
  return {
    getAll: () => useApi('/payment-methods', { method: 'GET' }),
    
    update: (id: number, data: any) => 
      useApi(`/payment-methods/${id}`, { 
        method: 'PUT', 
        body: data 
      }),
      
    toggleStatus: (id: number, isActive: boolean) => 
      useApi(`/payment-methods/${id}/status`, { 
        method: 'PATCH', 
        body: { is_active: isActive } 
      }),
  };
};