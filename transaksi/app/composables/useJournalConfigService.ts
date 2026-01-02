export const useJournalConfigService = () => {

    const findAll = async () => { 
        return await useApi('/journal-config', {
            method: 'GET'
        }); 
    };
    
    const getDiscovery = async () => { 
        return await useApi('/journal-config/discovery', {
            method: 'GET'
        }); 
     };

    const create = async (data: any) => { 
        return await useApi('/journal-config', {
            method: 'POST',
            body: data,
        }); 
    };

    const remove = async (uuid: string) => { 
        return await useApi(`/journal-config/${uuid}`, {
            method: 'DELETE',
        }); 
    };

    return { findAll, getDiscovery, create, remove };
};