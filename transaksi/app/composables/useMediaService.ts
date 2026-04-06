export const useMediaService = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/media`;

    const getAllMedia = async (path = '') => {
        return await useApi(API_BASE, { method: 'GET', params: { path } });
    };

    const createFolder = async (path: string, name: string) => {
        return await useApi(`${API_BASE}/folder`, {
            method: 'POST',
            body: { path, name }
        });
    };

    const uploadMedia = async (file: File, path = '') => {
        const formData = new FormData();
        formData.append('path', path); // Path HARUS di-append sebelum file
        formData.append('file', file);
        return await useApi(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
    };

    const deleteMedia = async (path: string) => {
        return await useApi(API_BASE, {
            method: 'DELETE',
            params: { path } // Menggunakan path agar bisa menghapus di dalam folder
        });
    };

    const getFileUrl = (path: string) => {
        if (!path) return '';
        let cleanPath = path.startsWith('/') ? path : `/${path}`;
        if (!cleanPath.includes('/uploads/')) cleanPath = `/uploads${cleanPath}`;
        const baseUrl = config.public.apiBase.replace('/api', '');
        return `${baseUrl}${cleanPath}`;
    };

    return { getAllMedia, createFolder, uploadMedia, deleteMedia, getFileUrl };
};