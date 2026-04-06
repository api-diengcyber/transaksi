<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Import Komponen List yang sudah dipisah
import ProductList from '~/components/product/ProductList.vue';
import CategoryList from '~/components/category/CategoryList.vue';
import ShelveList from '~/components/shelve/ShelveList.vue';
import UnitList from '~/components/unit/UnitList.vue';
import BrandList from '~/components/brand/BrandList.vue'; // <-- [BARU] Import Brand List

// Import Modal Form
import ProductCreateModal from '~/components/product/ProductCreateModal.vue';
import ShelveCreateModal from '~/components/shelve/ShelveCreateModal.vue';
import UnitCreateModal from '~/components/unit/UnitCreateModal.vue'; 
import BrandCreateModal from '~/components/brand/BrandCreateModal.vue'; // <-- [BARU] Import Brand Modal

// --- STATE ---
const activeMainTab = ref('products'); // 'products' | 'categories' | 'shelves' | 'units' | 'brands'

// Refs ke Child Components (agar bisa panggil method refresh() mereka)
const productListRef = ref(null);
const categoryListRef = ref(null);
const shelfListRef = ref(null);
const unitListRef = ref(null); 
const brandListRef = ref(null); // <-- [BARU] Ref untuk BrandList

// State Modal Produk
const showModal = ref(false);
const selectedProductUuid = ref(null);

// State Modal Rak
const showShelveModal = ref(false);
const selectedShelveData = ref(null);

// State Modal Satuan (Unit)
const showUnitModal = ref(false);
const selectedUnitData = ref(null);

// State Modal Merek (Brand)
const showBrandModal = ref(false); // <-- [BARU]
const selectedBrandData = ref(null); // <-- [BARU]

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
        productListRef.value.fetchProducts(); 
    }
};

// --- HANDLERS: RAK ---
const openCreateShelve = () => {
    selectedShelveData.value = null;
    showShelveModal.value = true;
};

const openEditShelve = (shelf) => {
    selectedShelveData.value = { ...shelf };
    showShelveModal.value = true;
};

const onShelveSaved = () => {
    if (shelfListRef.value) {
        shelfListRef.value.refresh();
    }
    showShelveModal.value = false;
};

// --- HANDLERS: SATUAN ---
const openCreateUnit = () => {
    selectedUnitData.value = null;
    showUnitModal.value = true;
};

const openEditUnit = (unit) => {
    selectedUnitData.value = { ...unit };
    showUnitModal.value = true;
};

const onUnitSaved = () => {
    if (unitListRef.value) {
        unitListRef.value.refresh();
    }
    showUnitModal.value = false;
};

// --- HANDLERS: MEREK (BRAND) [BARU] ---
const openCreateBrand = () => {
    selectedBrandData.value = null;
    showBrandModal.value = true;
};

const openEditBrand = (brand) => {
    selectedBrandData.value = { ...brand };
    showBrandModal.value = true;
};

const onBrandSaved = () => {
    if (brandListRef.value) {
        // Asumsi di dalam BrandList.vue Anda membuat fungsi expose refresh() atau fetchBrands()
        // Sesuaikan dengan nama fungsi yang ada di dalam komponen BrandList Anda
        brandListRef.value.fetchBrands ? brandListRef.value.fetchBrands() : brandListRef.value.refresh();
    }
    showBrandModal.value = false;
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

        <div class="flex flex-wrap items-end gap-3 mb-6 border-b border-surface-300">

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
                @click="activeMainTab = 'brands'"
                :class="getTabClass('brands')"
            >
                <i class="pi pi-bookmark"></i> Merek
            </button>
            
            <button 
                @click="activeMainTab = 'units'"
                :class="getTabClass('units')"
            >
                <i class="pi pi-hashtag"></i> Satuan
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

                <BrandList 
                    v-else-if="activeMainTab === 'brands'"
                    ref="brandListRef"
                    @create="openCreateBrand" 
                    @edit="openEditBrand"
                />

                <UnitList 
                    v-else-if="activeMainTab === 'units'"
                    ref="unitListRef"
                    @create="openCreateUnit" 
                    @edit="openEditUnit"
                />

                <ShelveList 
                    v-else-if="activeMainTab === 'shelves'"
                    fixedFilter="SHELF"
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

        <BrandCreateModal 
            v-model:visible="showBrandModal" 
            :editData="selectedBrandData" 
            @saved="onBrandSaved" 
        />

        <UnitCreateModal 
            v-model:visible="showUnitModal" 
            :unitData="selectedUnitData" 
            @saved="onUnitSaved" 
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
   di base.css dan menggunakan dukungan Dark Mode pada tombol tab. */
</style>