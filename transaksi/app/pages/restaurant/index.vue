<script setup>
import { ref, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Components for List View
import TableList from '~/components/table/TableList.vue';
import RecipeList from '~/components/recipe/RecipeList.vue';

// Components for Modals
import TableCreateModal from '~/components/table/TableCreateModal.vue';
import RecipeCreateModal from '~/components/recipe/RecipeCreateModal.vue';

const route = useRoute();
const router = useRouter();

// --- STATE ---
// 'tables' | 'recipes'
const activeMainTab = ref(route.query.tab || 'tables'); 

// Refs to Child Components
const tableListRef = ref(null);
const recipeListRef = ref(null);

// State Modals
const showTableModal = ref(false);
const selectedTableData = ref(null);

const showRecipeModal = ref(false);
const selectedRecipeProduct = ref(null);

// --- HANDLERS: MEJA (TABLE) ---
const openCreateTable = () => {
    selectedTableData.value = null;
    showTableModal.value = true;
};

const openEditTable = (table) => {
    selectedTableData.value = { ...table };
    showTableModal.value = true;
};

const onTableSaved = () => {
    if (tableListRef.value) {
        tableListRef.value.refresh();
    }
    showTableModal.value = false;
};

// --- HANDLERS: RESEP (RECIPE) ---
const openEditRecipe = (product) => {
    selectedRecipeProduct.value = product;
    showRecipeModal.value = true;
};

const onRecipeSaved = () => {
    if (recipeListRef.value) {
        recipeListRef.value.refresh();
    }
    showRecipeModal.value = false;
};

// --- UI / UTILS ---
const getTabClass = (tabName) => {
    return activeMainTab.value === tabName
        ? 'global-tab-active' 
        : 'global-tab-inactive';
};

// Sync tab state with URL query parameter
watch(() => route.query.tab, (newTab) => {
    activeMainTab.value = newTab || 'tables';
});

watch(activeMainTab, (newTab) => {
    // Update URL dan trigger refresh
    router.replace({ query: { tab: newTab } });
    nextTick(() => {
        if (newTab === 'tables' && tableListRef.value) {
            tableListRef.value.refresh();
        } else if (newTab === 'recipes' && recipeListRef.value) {
            recipeListRef.value.refresh();
        }
    });
});

onMounted(() => {
    activeMainTab.value = route.query.tab || 'tables';
});

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="h-[calc(100vh-5rem)]">
        
        <div class="flex items-end gap-3 mb-6 border-b border-surface-300 dark:border-surface-700">

            <button 
                @click="activeMainTab = 'tables'"
                :class="getTabClass('tables')"
            >
                <i class="pi pi-table"></i> Meja
            </button>

             <button 
                @click="activeMainTab = 'recipes'"
                :class="getTabClass('recipes')"
            >
                <i class="pi pi-book"></i> Resep
            </button>

        </div>

        <div class="content-area">
            <KeepAlive>
                
                <TableList
                    v-if="activeMainTab === 'tables'"
                    ref="tableListRef"
                    @create="openCreateTable"
                    @edit="openEditTable"
                />
                
                <RecipeList
                    v-else-if="activeMainTab === 'recipes'"
                    ref="recipeListRef"
                    @edit="openEditRecipe"
                />

            </KeepAlive>
        </div>


        <TableCreateModal 
            v-model:visible="showTableModal" 
            :tableData="selectedTableData" 
            @saved="onTableSaved" 
        />
        
        <RecipeCreateModal 
            v-model:visible="showRecipeModal" 
            :productData="selectedRecipeProduct" 
            @saved="onRecipeSaved" 
        />

    </div>
</template>

<style scoped>
/* Base style untuk semua tabs */
button {
    @apply flex items-center gap-2 cursor-pointer outline-none;
}

.content-area {
    /* Mengisi sisa ruang dan memastikan konten child tidak terpotong */
    height: calc(100% - 70px); 
    overflow: hidden;
}
</style>