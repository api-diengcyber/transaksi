export const useMemberService = () => {
    
    // Khusus mengambil user dengan role 'MEMBER'
    const getMembers = async (search: string = '') => {
        return await useApi('/user/find-all', { 
            method: 'GET',
            params: {
                role: 'MEMBER',
                search: search
            }
        });
    };

    const createMember = async (data: any) => {
        // Force role menjadi MEMBER
        const payload = { ...data, roles: ['MEMBER'] };
        return await useApi('/user/create', { method: 'POST', body: payload });
    };

    const updateMember = async (uuid: string, data: any) => {
        const payload = { ...data, roles: ['MEMBER'] };
        return await useApi(`/user/update/${uuid}`, { method: 'PUT', body: payload });
    };
    
    const updateMemberPassword = async (uuid: string, password: string) => {
        return await useApi(`/user/update-password/${uuid}`, { method: 'PUT', body: { password } });
    };

    const deleteMember = async (uuid: string) => {
        return await useApi(`/user/delete/${uuid}`, { method: 'DELETE' });
    };

    return {
        getMembers,
        createMember,
        updateMember,
        updateMemberPassword,
        deleteMember,
    };
};