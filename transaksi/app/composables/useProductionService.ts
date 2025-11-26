// composables/useProductionService.ts (Konsep)
export const useProductionService = () => {
    // ...
    const submitSetoran = async (payload: any) => {
        return await useApi('/journal/production/setoran', {
            method: 'POST',
            body: {
                details: payload, // Sesuaikan dengan format JournalController
                userId: '...' // Ambil dari Auth Store jika perlu
            }
        });
    };
    // ...
    return { submitSetoran, /* ... */ };
};