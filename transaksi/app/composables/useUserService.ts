// composables/useUserService.ts (Contoh Konsep)
export const useUserService = () => {
    // Anggap API_BASE dari useRuntimeConfig()
    const API_BASE = useRuntimeConfig().public.apiBase; 
    
    const fetchUsers = async (role?: string) => {
        const query = role ? `?role=${role}` : '';
        return await useApi(`/user/find-all/${query}`, { method: 'GET' });
    };

    const getAllRoles = async () => {
        return await useApi('/user/roles'); 
    };

    const createUser = async (payload: any) => {
        return await useApi('/user/create', { method: 'POST', body: payload });
    };

    const updateUser = async (uuid: string, payload: any) => {
        return await useApi(`/user/update/${uuid}`, { method: 'PUT', body: payload });
    };
    
    const deleteUser = async (uuid: string) => {
        return await useApi(`/user/delete/${uuid}`, { method: 'DELETE' });
    };

    return {
        fetchUsers,
        getAllRoles,
        createUser,
        updateUser,
        deleteUser,
    };
};