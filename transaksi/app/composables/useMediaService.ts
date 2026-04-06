export const useMediaService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/media`;

    // Ambil semua list file dari folder
    const getAllMedia = async () => {
        return await useApi(API_BASE, { method: 'GET' });
    };

    // Upload file baru
    const uploadMedia = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return await useApi(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
    };

    // Hapus file
    const deleteMedia = async (fileName: string) => {
        return await useApi(`${API_BASE}/${fileName}`, {
            method: 'DELETE'
        });
    };

    // Helper untuk mendapatkan Full URL Gambar
    const getFileUrl = (path: string) => {
        if (!path) return '';
        // Bersihkan path jika mengandung double slash
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        // Base API biasanya http://localhost:3000/api, kita butuh http://localhost:3000
        const baseUrl = config.public.apiBase.replace('/api', '');
        return `${baseUrl}${cleanPath}`;
    };

    return {
        getAllMedia,
        uploadMedia,
        deleteMedia,
        getFileUrl
    };
};