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
const activeMainTab = ref('products'); // 'products' | 'categories' | 'shelves'

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

// --- UTILS ---
const getTabClass = (tabName) => {
    return activeMainTab.value === tabName
        ? 'global-tab-active' 
        : 'global-tab-inactive'; 
};

definePageMeta({ layout: 'default' });
</script>

<template>
    <div class="">
        <Toast />
        <ConfirmDialog />

        <div class="flex items-end gap-3 mb-6 border-b border-surface-300 dark:border-surface-700">

            <button 
                @click="activeMainTab = 'products'"
                :class="getTabClass('products')"
            >
                <i class="pi pi-box"></i> Master Produk
            </button>

            <button 
                @click="activeMainTab = 'categories'"
                :class="getTabClass('categories')"
            >
                <i class="pi pi-tags"></i> Kategori
            </button>

            <button 
                @click="activeMainTab = 'shelves'"
                :class="getTabClass('shelves')"
            >
                <i class="pi pi-th-large"></i> Lokasi Rak
            </button>

        </div>


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
/* Base style untuk semua tabs */
button {
    @apply flex items-center gap-2 cursor-pointer outline-none;
}

.content-area {
    /* Mengisi sisa ruang dan memastikan konten child tidak terpotong */
    height: calc(100% - 70px); 
    overflow: hidden;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
/* Catatan: Class .global-tab-active dan .global-tab-inactive sudah didefinisikan 
   di base.css dan menggunakan dark:bg-surface-800 dan dark:border-surface-700 
   yang menjamin dukungan Dark Mode pada tombol tab. */
</style>