export const useSupplierService = () => {
    
    // Mengambil user dengan filter role 'SUPPLIER' dan dukungan pencarian
    const getSuppliers = async (search: string = '') => {
        return await useApi('/user/find-all', { 
            method: 'GET',
            params: {
                role: 'SUPPLIER',
                search: search
            }
        });
    };

    const createSupplier = async (data: any) => {
        // Otomatis set role menjadi SUPPLIER
        const payload = { ...data, roles: ['SUPPLIER'] };
        return await useApi('/user/create', { method: 'POST', body: payload });
    };

    const updateSupplier = async (uuid: string, data: any) => {
        const payload = { ...data, roles: ['SUPPLIER'] };
        return await useApi(`/user/update/${uuid}`, { method: 'PUT', body: payload });
    };
    
    // Khusus jika ingin reset password supplier
    const updateSupplierPassword = async (uuid: string, password: string) => {
        return await useApi(`/user/update-password/${uuid}`, { method: 'PUT', body: { password } });
    };

    const deleteSupplier = async (uuid: string) => {
        return await useApi(`/user/delete/${uuid}`, { method: 'DELETE' });
    };

    return {
        getSuppliers,
        createSupplier,
        updateSupplier,
        updateSupplierPassword,
        deleteSupplier,
    };
};