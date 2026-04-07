// app/composables/useIeService.ts
// Catatan: Anda tidak perlu import useApi karena Nuxt sudah auto-import composables.

export const useIeService = () => {
  // --- Fungsi Export ---
  const exportProduct = async (format: 'xlsx' | 'xls' | 'csv') => {
    try {
      // useApi Anda sudah otomatis menambahkan Token dan x-store-id!
      const response = await useApi(`/ie/product/export`, {
        method: 'GET',
        query: { format }, // Pada $fetch, gunakan 'query' (bukan 'params')
        responseType: 'blob', // Sangat penting agar $fetch mengembalikan format biner (Blob)
      });

      // Karena tipe responseType adalah 'blob', kembaliannya langsung berupa Blob
      const blobData = response as Blob;

      // Proses download file di browser
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data_produk.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Gagal export data:', error);
      throw error;
    }
  };

  // --- Fungsi Import ---
  const importProduct = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // useApi Anda sudah otomatis menambahkan Token dan x-store-id!
      const response = await useApi(`/ie/product/import`, {
        method: 'POST',
        body: formData,
        // PENTING: Saat menggunakan $fetch dan FormData, JANGAN MENGISI header Content-Type manual.
        // Browser akan otomatis menyetel 'multipart/form-data' beserta kode 'boundary' yang unik.
      });
      
      return response; 
    } catch (error) {
      console.error('Gagal import data:', error);
      throw error;
    }
  };

  return {
    exportProduct,
    importProduct,
  };
};