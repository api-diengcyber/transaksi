export const useSystemService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/system`;

    // Ambil isi teks log dari server
    const getLogs = async () => {
        return await useApi(`${API_BASE}/logs`, {
            method: 'GET'
        });
    };

    return { getLogs };
};