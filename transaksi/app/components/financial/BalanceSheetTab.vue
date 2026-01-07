<script setup lang="ts">
import { computed } from 'vue';

// --- Types ---
interface Account {
    uuid: string;
    code: string;
    name: string;
    balance: number;
    parentAccountUuid?: string | null;
}

interface TreeNode {
    key: string;
    data: Account;
    children: TreeNode[];
    styleClass?: string; // Untuk styling baris khusus (highlight laba)
    leaf: boolean;
}

// --- Props ---
const props = defineProps<{
    data: {
        assets: any[];
        liabilities: any[];
        equity: any[];
        totalAsset: number;
        totalLiability: number;
        totalEquityFinal: number;
        currentEarnings: number; // Prop ini berisi nilai Laba/Rugi
    }
}>();

// --- Formatting ---
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

// --- Tree Building Logic ---
const buildTree = (accounts: any[], extraNode: any = null): TreeNode[] => {
    if (!accounts || accounts.length === 0) {
        // Jika tidak ada akun ekuitas tapi ada extraNode (laba), tetap tampilkan laba
        return extraNode ? [extraNode] : [];
    }

    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // 1. Init Map
    accounts.forEach(acc => {
        const bal = Number(acc.balance) || 0;
        map.set(acc.uuid, {
            key: acc.uuid,
            data: { ...acc, balance: bal },
            children: [],
            leaf: true
        });
    });

    // 2. Build Hierarchy
    accounts.forEach(acc => {
        const node = map.get(acc.uuid);
        if (!node) return;

        if (acc.parentAccountUuid && map.has(acc.parentAccountUuid)) {
            const parent = map.get(acc.parentAccountUuid);
            parent!.children.push(node);
            parent!.leaf = false;
        } else {
            roots.push(node);
        }
    });

    // 3. Inject Extra Node (Laba Tahun Berjalan) ke Root Equity
    if (extraNode) {
        roots.push(extraNode);
    }

    // 4. Recursive Sum (Hitung Total Parent berdasarkan Anak)
    const calculateTotals = (node: TreeNode): number => {
        if (!node.leaf && node.children.length > 0) {
            let sum = 0;
            for (const child of node.children) {
                sum += calculateTotals(child);
            }
            // Jika parent hanyalah wrapper, kita timpa nilainya dengan sum anak
            // Jika parent punya transaksi sendiri, tambahkan logic: sum += node.data.balance;
            node.data.balance = sum;
        }
        return node.data.balance;
    };

    roots.forEach(root => calculateTotals(root));

    // 5. Sort by Code (Agar urutan rapi)
    const sortTree = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => (a.data.code || '').localeCompare(b.data.code || ''));
        nodes.forEach(n => {
            if (n.children.length) sortTree(n.children);
        });
    };
    sortTree(roots);

    return roots;
};

// --- Computed Trees ---
const assetTree = computed(() => buildTree(props.data.assets));
const liabilityTree = computed(() => buildTree(props.data.liabilities));

const equityTree = computed(() => {
    // Buat Node Buatan untuk Laba/Rugi
    let earningNode = null;
    
    // Kita selalu tampilkan baris ini meskipun 0 agar jelas, atau bisa di-cek !== 0
    earningNode = {
        key: 'current-earnings',
        data: {
            uuid: 'temp-earnings',
            code: '3-9999', // Kode dummy agar muncul di paling bawah/sesuai urutan
            name: 'Laba Tahun Berjalan (Current Earnings)',
            balance: props.data.currentEarnings,
            parentAccountUuid: null
        },
        children: [],
        leaf: true,
        styleClass: props.data.currentEarnings >= 0 
            ? 'bg-green-50 text-green-700 font-bold italic' 
            : 'bg-red-50 text-red-700 font-bold italic'
    };
    
    return buildTree(props.data.equity, earningNode);
});
</script>

<template>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in font-sans pb-10">
            
        <div class="flex flex-col h-full">
            <div class="bg-surface-0  rounded-xl shadow-sm border border-surface-200  overflow-hidden flex flex-col h-full">
                <div class="p-4 bg-blue-50 border-b border-blue-100  flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-briefcase text-blue-600 "></i>
                        <h3 class="font-bold text-blue-900 ">AKTIVA / ASET</h3>
                    </div>
                    <span class="font-black text-lg text-blue-700 ">
                        {{ formatCurrency(data.totalAsset) }}
                    </span>
                </div>

                <div class="flex-1 p-0">
                    <TreeTable :value="assetTree" class="custom-treetable" :autoLayout="true">
                        <Column field="name" header="Nama Akun" expander>
                            <template #body="slotProps">
                                <span :class="{ 'font-bold ': !slotProps.node.leaf }">
                                    {{ slotProps.node.data.name }}
                                </span>
                            </template>
                        </Column>
                        <Column field="code" header="Kode" style="width: 100px; text-align: right;">
                             <template #body="slotProps">
                                <span class="text-xs font-mono text-surface-400">{{ slotProps.node.data.code }}</span>
                            </template>
                        </Column>
                        <Column field="balance" header="Nilai" style="width: 160px; text-align: right;">
                            <template #body="slotProps">
                                <span class="font-mono text-sm" :class="{ 'font-bold': !slotProps.node.leaf }">
                                    {{ formatCurrency(slotProps.node.data.balance) }}
                                </span>
                            </template>
                        </Column>
                    </TreeTable>
                </div>
            </div>
        </div>

        <div class="flex flex-col gap-6">
            
            <div class="bg-surface-0  rounded-xl shadow-sm border border-surface-200  overflow-hidden">
                <div class="p-4 bg-orange-50 border-b border-orange-100  flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-exclamation-circle text-orange-600 "></i>
                        <h3 class="font-bold text-orange-900 ">KEWAJIBAN / HUTANG</h3>
                    </div>
                    <span class="font-bold text-lg text-orange-700 ">
                        {{ formatCurrency(data.totalLiability) }}
                    </span>
                </div>
                
                <TreeTable :value="liabilityTree" class="custom-treetable" :autoLayout="true">
                    <Column field="name" header="Nama Akun" expander>
                        <template #body="slotProps">
                            <span :class="{ 'font-bold ': !slotProps.node.leaf }">
                                {{ slotProps.node.data.name }}
                            </span>
                        </template>
                    </Column>
                    <Column field="code" header="Kode" style="width: 100px; text-align: right;">
                             <template #body="slotProps">
                                <span class="text-xs font-mono text-surface-400">{{ slotProps.node.data.code }}</span>
                            </template>
                        </Column>
                    <Column field="balance" header="Nilai" style="width: 160px; text-align: right;">
                        <template #body="slotProps">
                            <span class="font-mono text-sm" :class="{ 'font-bold': !slotProps.node.leaf }">
                                {{ formatCurrency(slotProps.node.data.balance) }}
                            </span>
                        </template>
                    </Column>
                </TreeTable>
            </div>

            <div class="bg-surface-0  rounded-xl shadow-sm border border-surface-200  overflow-hidden">
                <div class="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-wallet text-purple-600 "></i>
                        <h3 class="font-bold text-purple-900 ">MODAL / EKUITAS</h3>
                    </div>
                    <span class="font-bold text-lg text-purple-700 ">
                        {{ formatCurrency(data.totalEquityFinal) }}
                    </span>
                </div>
                
                <TreeTable :value="equityTree" class="custom-treetable" :autoLayout="true">
                    <Column field="name" header="Nama Akun" expander>
                        <template #body="slotProps">
                            <div :class="[
                                slotProps.node.styleClass ? 'px-2 py-1 rounded -ml-2 w-full ' + slotProps.node.styleClass : '',
                                { 'font-bold ': !slotProps.node.leaf }
                            ]">
                                {{ slotProps.node.data.name }}
                            </div>
                        </template>
                    </Column>
                    <Column field="code" header="Kode" style="width: 100px; text-align: right;">
                             <template #body="slotProps">
                                <span class="text-xs font-mono text-surface-400">{{ slotProps.node.data.code }}</span>
                            </template>
                        </Column>
                    <Column field="balance" header="Nilai" style="width: 160px; text-align: right;">
                        <template #body="slotProps">
                            <span class="font-mono text-sm" :class="{ 'font-bold': !slotProps.node.leaf }">
                                {{ formatCurrency(slotProps.node.data.balance) }}
                            </span>
                        </template>
                    </Column>
                </TreeTable>
            </div>

            <div class="p-5 rounded-xl bg-surface-800 text-white shadow-lg flex justify-between items-center transform transition-transform hover:scale-[1.01]">
                <div class="flex flex-col">
                    <span class="text-xs font-bold uppercase tracking-widest text-surface-400 mb-1">Total Pasiva</span>
                    <span class="text-xs opacity-70">Total Kewajiban + Total Ekuitas (termasuk Laba)</span>
                </div>
                <span class="font-black text-2xl tracking-tight">
                    {{ formatCurrency(data.totalLiability + data.totalEquityFinal) }}
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Custom TreeTable Styling */
:deep(.custom-treetable .p-treetable-thead > tr > th) {
    background: transparent;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #94a3b8;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
}
:deep(.custom-treetable .p-treetable-tbody > tr > td) {
    padding: 0.5rem 1rem;
    border: none;
}
:deep(.custom-treetable .p-treetable-tbody > tr:hover) {
    background-color: #f8fafc;
}

/* Dark Mode Support */
:deep(.dark .custom-treetable .p-treetable-thead > tr > th) {
    border-bottom: 1px solid #334155;
}
:deep(.dark .custom-treetable .p-treetable-tbody > tr:hover) {
    background-color: #1e293b;
}

:deep(.p-treetable-toggler) {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.5rem;
    color: #64748b;
}
</style>