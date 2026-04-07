<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

// Import Komponen List murni (Tanpa tombol IE)
import ProductList from '~/components/product/ProductList.vue';
import CategoryList from '~/components/category/CategoryList.vue';
import ShelveList from '~/components/shelve/ShelveList.vue';
import UnitList from '~/components/unit/UnitList.vue';
import BrandList from '~/components/brand/BrandList.vue';

// [BARU] Import Komponen Tampilan Utama IE Murni
import ProductImportExportView from '~/components/product/ProductImportExportView.vue'; 

// Import Modals...
import ProductCreateModal from '~/components/product/ProductCreateModal.vue';
import ShelveCreateModal from '~/components/shelve/ShelveCreateModal.vue';
import UnitCreateModal from '~/components/unit/UnitCreateModal.vue'; 
import BrandCreateModal from '~/components/brand/BrandCreateModal.vue';

// --- STATE TAB ---
// [BARU] Tambahkan state tab untuk mengontrol refresh tabel Master Produk
const productListRef = ref(null);
const categoryListRef = ref(null);
const shelfListRef = ref(null);
const unitListRef = ref(null); 
const brandListRef = ref(null);

const activeMainTab = ref('products');

// State Modal...
const showModal = ref(false);
const selectedProductUuid = ref(null);
const showShelveModal = ref(false);
const selectedShelveData = ref(null);
const showUnitModal = ref(false);
const selectedUnitData = ref(null);
const showBrandModal = ref(false);
const selectedBrandData = ref(null);

// --- HANDLERS ---
// [BARU] Fungsi callback untuk me-refresh data Master Produk setelah import sukses
const onProductImported = () => {
    // Alihkan kembali ke tab Master Produk agar user melihat hasilnya
    activeMainTab.value = 'products';
    // Gunakan nextTick agar tabel di-mount dulu sebelum di-refresh
    nextTick(() => {
        if (productListRef.value) {
            productListRef.value.fetchProducts(); 
        }
    });
};

const openCreateProduct = () => {
    selectedProductUuid.value = null;
    showModal.value = true;
};

const openEditProduct = (product) => {
    selectedProductUuid.value = product.uuid;
    showModal.value = true;
};

const onProductSaved = () => {
    if (productListRef.value) {
        productListRef.value.fetchProducts(); 
    }
};

// Handlers Rak, Satuan, Merek... (Hapus tombol IE dari tab bar sebelumnya)
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

            <button 
                @click="activeMainTab = 'import_export'"
                :class="getTabClass('import_export')"
            >
                <i class="pi pi-file-export"></i> Impor / Ekspor
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

                <ProductImportExportView 
                    v-else-if="activeMainTab === 'import_export'"
                    @import-success="onProductImported"
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
.content-area {
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
</style>