<script setup lang="ts">
// Menerima data hasil perhitungan dari parent
const props = defineProps<{
    data: {
        revenue: any[];
        expense: any[];
        totalRevenue: number;
        totalExpense: number;
        netProfit: number;
    }
}>();

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};
</script>

<template>
    <div class="flex flex-col gap-4 max-w-4xl mx-auto w-full animate-fade-in">
        
        <div class="p-6 rounded-2xl bg-surface-0 dark:bg-surface-100 shadow-sm border border-surface-200 dark:border-surface-700 text-center relative overflow-hidden">
            <p class="text-sm font-bold text-surface-500 uppercase tracking-widest mb-2">Laba / Rugi Bersih</p>
            <h2 class="text-4xl font-black" :class="data.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                {{ formatCurrency(data.netProfit) }}
            </h2>
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
        </div>

        <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div class="p-4 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                <h3 class="font-bold text-surface-800 dark:text-surface-0">PENDAPATAN (REVENUE)</h3>
                <span class="font-bold text-emerald-600">{{ formatCurrency(data.totalRevenue) }}</span>
            </div>
            <DataTable :value="data.revenue" size="small" stripedRows>
                <Column field="code" header="Kode" style="width: 15%"></Column>
                <Column field="name" header="Nama Akun"></Column>
                <Column field="balance" header="Saldo" class="text-right">
                    <template #body="slotProps">
                        {{ formatCurrency(slotProps.data.balance) }}
                    </template>
                </Column>
            </DataTable>
        </div>

        <div class="bg-surface-0 dark:bg-surface-100 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 overflow-hidden">
            <div class="p-4 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
                <h3 class="font-bold text-surface-800 dark:text-surface-0">BEBAN (EXPENSE)</h3>
                <span class="font-bold text-rose-600">{{ formatCurrency(data.totalExpense) }}</span>
            </div>
            <DataTable :value="data.expense" size="small" stripedRows>
                <Column field="code" header="Kode" style="width: 15%"></Column>
                <Column field="name" header="Nama Akun"></Column>
                <Column field="balance" header="Saldo" class="text-right">
                    <template #body="slotProps">
                        {{ formatCurrency(slotProps.data.balance) }}
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>