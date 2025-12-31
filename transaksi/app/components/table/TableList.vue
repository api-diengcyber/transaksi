<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Emits untuk parent (TableController / Index)
const emit = defineEmits(['create', 'edit']);

// Services & Utils
const tableService = useTableService(); // Pastikan composable ini sudah diupdate dengan fungsi baru
const toast = useToast();
const confirm = useConfirm();

// State Data
const tables = ref([]);
const loading = ref(false);

// State Booking Modal
const showBookingModal = ref(false);
const bookingForm = ref({
    uuid: null,
    bookingName: '',
    bookingTime: '',
});

// --- FETCH DATA ---
const fetchTables = async () => {
    loading.value = true;
    try {
        const data = await tableService.getAllTables();
        tables.value = data || [];
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Gagal memuat data meja', life: 3000 });
    } finally {
        loading.value = false;
    }
};

// --- CRUD BASIC ---
const confirmDeleteTable = (event, table) => {
    event.stopPropagation();
    confirm.require({
        message: `Hapus Meja ${table.name}?`,
        header: 'Konfirmasi Hapus Meja',
        icon: 'pi pi-trash',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await tableService.deleteTable(table.uuid);
                toast.add({ severity: 'success', summary: 'Terhapus', detail: 'Meja berhasil dihapus', life: 3000 });
                fetchTables();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal menghapus meja', life: 3000 });
            }
        }
    });
};

// --- FEATURE: BOOKING ---
const openBookingModal = (table) => {
    bookingForm.value = {
        uuid: table.uuid,
        tableName: table.name,
        bookingName: '',
        bookingTime: null, // Menggunakan Date object untuk Calendar PrimeVue
    };
    showBookingModal.value = true;
};

const submitBooking = async () => {
    if (!bookingForm.value.bookingName || !bookingForm.value.bookingTime) {
        toast.add({ severity: 'warn', summary: 'Validasi', detail: 'Nama dan Waktu harus diisi', life: 3000 });
        return;
    }

    try {
        // Konversi payload sesuai DTO
        const payload = {
            bookingName: bookingForm.value.bookingName,
            bookingTime: new Date(bookingForm.value.bookingTime).toISOString(),
        };

        await tableService.bookTable(bookingForm.value.uuid, payload);
        toast.add({ severity: 'success', summary: 'Berhasil', detail: 'Meja berhasil di-booking', life: 3000 });
        showBookingModal.value = false;
        fetchTables();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal melakukan booking', life: 3000 });
    }
};

// --- FEATURE: CHECK-IN (OCCUPY) ---
const handleCheckIn = (event, table) => {
    event.stopPropagation();
    confirm.require({
        target: event.currentTarget,
        message: `Tamu sudah datang di ${table.name}?`,
        header: 'Konfirmasi Masuk (Check-In)',
        icon: 'pi pi-check-circle',
        acceptClass: 'p-button-success',
        accept: async () => {
            try {
                await tableService.occupyTable(table.uuid);
                toast.add({ severity: 'success', summary: 'Check-In', detail: 'Status meja berubah menjadi Terisi', life: 3000 });
                fetchTables();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal update status meja', life: 3000 });
            }
        }
    });
};

// --- FEATURE: CLEAR (SELESAI) ---
const handleClearTable = (event, table) => {
    event.stopPropagation();
    confirm.require({
        target: event.currentTarget,
        message: `Meja ${table.name} sudah kosong dan bersih?`,
        header: 'Selesaikan Meja',
        icon: 'pi pi-refresh',
        acceptClass: 'p-button-info',
        accept: async () => {
            try {
                await tableService.clearTable(table.uuid);
                toast.add({ severity: 'success', summary: 'Selesai', detail: 'Meja sekarang tersedia kembali', life: 3000 });
                fetchTables();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Gagal', detail: 'Gagal membersihkan meja', life: 3000 });
            }
        }
    });
};

// --- UI HELPERS ---
const getCardClass = (status) => {
    switch (status) {
        case 'OCCUPIED':
            return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
        case 'BOOKED':
            return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
        default: // AVAILABLE
            return 'bg-surface-0 dark:bg-surface-800 border-surface-200 dark:border-surface-700';
    }
};

const getStatusLabel = (status) => {
    switch (status) {
        case 'OCCUPIED': return 'Terisi';
        case 'BOOKED': return 'Dipesan';
        default: return 'Tersedia';
    }
};

const getStatusBadge = (status) => {
    switch (status) {
        case 'OCCUPIED': return 'danger';
        case 'BOOKED': return 'warning';
        default: return 'success';
    }
};

// Format Jam untuk tampilan Booking
const formatTime = (dateStr) => {
    if(!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
    fetchTables();
});

defineExpose({ refresh: fetchTables });
</script>

<template>
    <div class="animate-fade-in h-full flex flex-col">
        <div class="flex justify-between items-center mb-6">
             <h2 class="font-bold text-xl text-surface-700 dark:text-surface-100 flex items-center gap-2">
                <i class="pi pi-th-large"></i> Manajemen Meja
             </h2>
             <div class="flex gap-2">
                 <Button icon="pi pi-refresh" text rounded @click="fetchTables" v-tooltip.bottom="'Refresh Data'" />
             </div>
        </div>

        <div v-if="loading" class="flex-1 flex justify-center items-center">
            <ProgressSpinner style="width: 50px; height: 50px" />
        </div>

        <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 overflow-y-auto pb-4 content-start">
            
            <div @click="emit('create')" 
                class="min-h-[180px] rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 hover:border-primary-400 transition-all group"
            >
                <div class="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 text-surface-400 group-hover:text-primary-500 flex items-center justify-center mb-3 transition-colors">
                    <i class="pi pi-plus text-xl"></i>
                </div>
                <span class="font-semibold text-surface-500 dark:text-surface-400 group-hover:text-primary-600 dark:group-hover:text-primary-400">Tambah Meja</span>
            </div>

            <div v-for="table in tables" :key="table.uuid" 
                :class="['rounded-xl shadow-sm border p-4 flex flex-col justify-between transition-all relative group hover:shadow-md', getCardClass(table.status)]"
                class="min-h-[180px]"
            >
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" @click.stop="emit('edit', table)" v-tooltip.top="'Edit Data Meja'" />
                    <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click.stop="(e) => confirmDeleteTable(e, table)" v-tooltip.top="'Hapus Meja'" />
                </div>

                <div class="absolute top-3 left-3">
                    <Tag :value="getStatusLabel(table.status)" :severity="getStatusBadge(table.status)" class="text-xs px-2 py-1"></Tag>
                </div>

                <div class="flex flex-col items-center justify-center flex-1 mt-6 mb-2 text-center">
                    <i class="pi pi-table text-5xl mb-3 transition-colors" 
                       :class="{
                           'text-green-500 dark:text-green-400': table.status === 'AVAILABLE',
                           'text-yellow-500 dark:text-yellow-400': table.status === 'BOOKED',
                           'text-red-500 dark:text-red-400': table.status === 'OCCUPIED'
                       }"
                    ></i>
                    
                    <h3 class="font-bold text-lg text-surface-800 dark:text-surface-100 line-clamp-1">{{ table.name }}</h3>
                    <p class="text-sm text-surface-500 mb-1">Kapasitas: {{ table.capacity }} Org</p>

                    <div v-if="table.status === 'BOOKED'" class="mt-2 p-2 bg-white/50 dark:bg-black/20 rounded text-xs w-full">
                        <div class="font-semibold text-surface-700 dark:text-surface-200 truncate">{{ table.bookingName }}</div>
                        <div class="text-surface-500 flex items-center justify-center gap-1">
                            <i class="pi pi-clock text-[10px]"></i> {{ formatTime(table.bookingTime) }}
                        </div>
                    </div>
                </div>

                <div class="flex justify-center gap-2 mt-2 pt-3 border-t border-surface-200 dark:border-surface-600/50">
                    
                    <Button 
                        v-if="table.status === 'AVAILABLE'" 
                        label="Book" 
                        icon="pi pi-calendar-plus" 
                        size="small" 
                        outlined 
                        severity="warning" 
                        class="w-full p-1 text-xs h-8"
                        @click.stop="openBookingModal(table)"
                    />

                    <Button 
                        v-if="table.status === 'AVAILABLE' || table.status === 'BOOKED'" 
                        label="Check-In" 
                        icon="pi pi-sign-in" 
                        size="small" 
                        outlined={table.status != 'BOOKED'} 
                        severity="success" 
                        class="w-full p-1 text-xs h-8"
                        @click.stop="(e) => handleCheckIn(e, table)"
                    />

                    <Button 
                        v-if="table.status === 'OCCUPIED'" 
                        label="Selesai" 
                        icon="pi pi-check" 
                        size="small" 
                        severity="info" 
                        class="w-full p-1 text-xs h-8"
                        @click.stop="(e) => handleClearTable(e, table)"
                    />
                </div>
            </div>
            
            <div v-if="tables.length === 0 && !loading" class="col-span-full text-center py-20">
                <i class="pi pi-inbox text-4xl text-surface-300 mb-3"></i>
                <p class="text-surface-500">Belum ada data meja.</p>
            </div>
        </div>

        <Dialog v-model:visible="showBookingModal" modal header="Booking Meja" :style="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <div class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center gap-3">
                    <i class="pi pi-info-circle text-primary-600 text-xl"></i>
                    <div>
                        <p class="text-xs text-surface-500 uppercase font-bold tracking-wider">Meja Dipilih</p>
                        <p class="font-bold text-lg text-primary-700 dark:text-primary-400">{{ bookingForm.tableName }}</p>
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-semibold text-sm">Nama Pelanggan</label>
                    <InputText v-model="bookingForm.bookingName" placeholder="Contoh: Bpk. Budi" autofocus />
                </div>
                
                <div class="flex flex-col gap-2">
                    <label class="font-semibold text-sm">Waktu Booking</label>
                    <Calendar v-model="bookingForm.bookingTime" showTime hourFormat="24" placeholder="Pilih tanggal & jam" />
                </div>
            </div>
            <template #footer>
                <Button label="Batal" icon="pi pi-times" text @click="showBookingModal = false" />
                <Button label="Simpan Booking" icon="pi pi-check" @click="submitBooking" autofocus />
            </template>
        </Dialog>

    </div>
</template>