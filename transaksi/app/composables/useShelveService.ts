export const useShelveService = () => {
    const config = useRuntimeConfig();
    // Sesuaikan BASE_URL dengan alamat backend NestJS kamu (misal: http://localhost:3000)
    const API_URL = config.public.apiBaseUrl; 

    const getAllShelves = async () => {
        return await useApi('/shelve/find-all');
    };

    const getShelve = async (uuid: string) => {
        return await useApi(`/shelve/${uuid}`);
    };

    const createShelve = async (payload: any) => {
        return await useApi('/shelve/create', {
            method: 'POST',
            body: payload
        });
    };

    const updateShelve = async (uuid: string, payload: any) => {
        return await useApi(`/shelve/update/${uuid}`, {
            method: 'PUT',
            body: payload
        });
    };

    const deleteShelve = async (uuid: string) => {
        return await useApi(`/shelve/delete/${uuid}`, {
            method: 'DELETE'
        });
    };

    return {
        getAllShelves,
        getShelve,
        createShelve,
        updateShelve,
        deleteShelve
    };
};