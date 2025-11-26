// composables/useUserService.ts (Contoh Konsep)
export const useUserService = () => {
    // Anggap API_BASE dari useRuntimeConfig()
    const API_BASE = useRuntimeConfig().public.apiBase; 

    const getAllUsers = async () => {
        // Asumsi endpoint: GET /user/find-all (melindungi dengan AtGuard)
        return await useApi('/user/find-all');
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
        getAllUsers,
        getAllRoles,
        createUser,
        updateUser,
        deleteUser,
    };
};