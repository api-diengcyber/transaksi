<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Import Komponen List yang sudah dipisah
import ProductList from '~/components/ProductList.vue';
import CategoryList from '~/components/CategoryList.vue';
import ShelveList from '~/components/ShelveList.vue';

// Import Modal Form
import ProductCreateModal from '~/components/ProductCreateModal.vue';
import ShelveCreateModal from '~/components/ShelveCreateModal.vue';

// --- STATE ---
const activeMainTab = ref('products'); // 'products' | 'shelves'

// Refs ke Child Components (agar bisa panggil method refresh() mereka)
const productListRef = ref(null);
const categoryListRef = ref(null);
const shelfListRef = ref(null);

// State Modal Produk
const showModal = ref(false);
const selectedProductUuid = ref(null);

// State Modal Rak
const showShelveModal = ref(false);
const selectedShelveData = ref(null);

// --- HANDLERS: PRODUK ---
const openCreateProduct = () => {
    selectedProductUuid.value = null;
    showModal.value = true;
};

const openEditProduct = (product) => {
    selectedProductUuid.value = product.uuid;
    showModal.value = true;
};

const onProductSaved = () => {
    // Refresh data tabel produk tanpa reload halaman
    if (productListRef.value) {
        productListRef.value.refresh();
    }
};

// --- HANDLERS: RAK ---
const openCreateShelve = () => {
    selectedShelveData.value = null;
    showShelveModal.value = true;
};

const openEditShelve = (shelf) => {
    // Clone object agar data di grid tidak berubah real-time saat diketik di form
    selectedShelveData.value = { ...shelf };
    showShelveModal.value = true;
};

const onShelveSaved = () => {
    // Refresh data grid rak
    if (shelfListRef.value) {
        shelfListRef.value.refresh();
    }
    showShelveModal.value = false;
};

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="animate-fade-in p-4 min-h-screen bg-surface-50 dark:bg-surface-950">
        <Toast />
        <ConfirmDialog />

        <!-- NAVIGATION TABS -->
        <div class="flex items-center gap-4 mb-6 border-b border-surface-200 dark:border-surface-700 pb-1">

            <!-- Master Produk -->
            <button 
                @click="activeMainTab = 'products'"
                class="px-4 py-2 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2"
                :class="activeMainTab === 'products'
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50 rounded-t-lg'
                    : 'border-transparent text-surface-500 hover:text-surface-700'"
            >
                <i class="pi pi-box"></i> Master Produk
            </button>

            <!-- Kategori (NEW TAB) -->
            <button 
                @click="activeMainTab = 'categories'"
                class="px-4 py-2 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2"
                :class="activeMainTab === 'categories'
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50 rounded-t-lg'
                    : 'border-transparent text-surface-500 hover:text-surface-700'"
            >
                <i class="pi pi-tags"></i> Kategori
            </button>

            <!-- Lokasi Rak -->
            <button 
                @click="activeMainTab = 'shelves'"
                class="px-4 py-2 text-sm font-bold border-b-2 transition-all duration-200 flex items-center gap-2"
                :class="activeMainTab === 'shelves'
                    ? 'border-primary-500 text-primary-600 bg-primary-50/50 rounded-t-lg'
                    : 'border-transparent text-surface-500 hover:text-surface-700'"
            >
                <i class="pi pi-th-large"></i> Lokasi Rak / Shelves
            </button>

        </div>


        <!-- CONTENT AREA -->
        <div class="content-area">
            <KeepAlive>
            
                <ProductList 
                    v-if="activeMainTab === 'products'"
                    ref="productListRef"
                    @create="openCreateProduct" 
                    @edit="openEditProduct"
                />

                <CategoryList
                    v-else-if="activeMainTab === 'categories'"
                    ref="categoryListRef"
                />

                <ShelveList 
                    v-else-if="activeMainTab === 'shelves'"
                    ref="shelfListRef"
                    @create="openCreateShelve" 
                    @edit="openEditShelve"
                />

            </KeepAlive>
        </div>


        <ProductCreateModal 
            v-model:visible="showModal" 
            :productUuid="selectedProductUuid" 
            @product-created="onProductSaved" 
            @product-updated="onProductSaved" 
        />

        <ShelveCreateModal 
            v-model:visible="showShelveModal" 
            :shelfData="selectedShelveData" 
            @saved="onShelveSaved" 
        />

    </div>
</template>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>