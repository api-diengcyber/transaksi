export const useAccountService = () => {

    const getAll = async () => {
        return await useApi('/account', {
            method: 'GET'
        });
    }

    const getCategories = async () => {
        return await useApi('/account/categories', {
            method: 'GET'
        });
    }

    const create = async (payload: any) => {
        return await useApi('/account', {
            method: 'POST',
            body: payload,
        });
    }

    const update = async (uuid: string, payload: any) => {
        return await useApi(`/account/${uuid}`, {
            method: 'PATCH',
            body: payload,
        });
    }

    const remove = async (uuid: string) => {
        return await useApi(`/account/${uuid}`, {
            method: 'DELETE'
        });
    }

    return {
        getAll,
        getCategories,
        create,
        update,
        remove
    }
}