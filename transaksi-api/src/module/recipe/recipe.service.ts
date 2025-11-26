import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { ProductService } from '../product/product.service';
import { ProductRecipeIngredientEntity } from 'src/common/entities/product_recipe_ingredient/product_recipe_ingredient.entity';

// --- DTO Interface (sesuai dengan payload dari controller) ---
interface IngredientPayload {
  ingredientProductUuid: string;
  unitUuid: string;
  qty: number;
}
// --- END DTO Interface ---

// [BARU] Helper untuk menghasilkan pengenal lokal
const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
// [BARU] Helper untuk menghasilkan UUID Recipe Ingredient (Format: [storeUuid]-RCI-[local_identifier])
const generateRecipeIngredientUuid = (storeUuid: string) => `${storeUuid}-RCI-${generateLocalUuid()}`;

@Injectable()
export class RecipeService {
  constructor(
    @Inject('PRODUCT_RECIPE_INGREDIENT_REPOSITORY')
    private readonly recipeRepo: Repository<ProductRecipeIngredientEntity>,
    @Inject('DATA_SOURCE')
    private readonly dataSource: DataSource,
    private readonly productService: ProductService, // Inject ProductService untuk validasi produk
  ) { }

  // ============================
  // GET RECIPE BY PRODUCT UUID
  // ============================
  async getRecipeByProduct(productUuid: string, storeUuid: string) {
    // 1. Validasi Product (Recipe) Ownership
    const product = await this.productService.findOne(productUuid, storeUuid);
    if (!product) {
      throw new NotFoundException(`Product (Menu) with UUID ${productUuid} not found.`);
    }

    // 2. Ambil Resep
    // Note: Pastikan relasi di entitas pivot di-load
    const ingredients = await this.recipeRepo.find({
      where: { recipeProductUuid: productUuid },
      relations: ['ingredientProduct', 'unit'],
    });

    return {
      recipeProductUuid: productUuid,
      productName: product.name,
      ingredients: ingredients.map(i => ({
        // Kembalikan semua detail yang dibutuhkan oleh frontend
        ingredientProductUuid: i.ingredientProductUuid,
        productName: i.ingredientProduct?.name || 'Unknown',
        unitUuid: i.unitUuid,
        unitName: i.unit?.unitName || 'Unknown',
        qty: i.qty,
      })),
    };
  }

  // ============================
  // SAVE / UPDATE RECIPE (Transactional)
  // ============================
  async saveRecipe(productUuid: string, ingredients: IngredientPayload[], userId: string, storeUuid: string) {
    // 1. Validasi Product (Recipe) Ownership
    const product = await this.productService.findOne(productUuid, storeUuid);
    if (!product) {
      throw new NotFoundException(`Product (Menu) with UUID ${productUuid} not found.`);
    }

    // 2. Memastikan semua Ingredient dan Unit adalah valid
    const allStoreProducts = await this.productService.findAll(storeUuid);
    const productMap = new Map(allStoreProducts.map(p => [p.uuid, p]));

    for (const item of ingredients) {
      const ingredientProduct = productMap.get(item.ingredientProductUuid);
      if (!ingredientProduct) {
        throw new BadRequestException(`Ingredient product UUID ${item.ingredientProductUuid} not found.`);
      }
      // Pastikan Unit yang digunakan memang milik produk ingredient tersebut
      const unitExists = ingredientProduct.units.some(u => u.uuid === item.unitUuid);
      if (!unitExists) {
        throw new BadRequestException(`Unit UUID ${item.unitUuid} is not valid for ingredient product ${ingredientProduct.name}.`);
      }
      // Cek self-reference
      if (item.ingredientProductUuid === productUuid) {
        throw new BadRequestException(`Product cannot be an ingredient of itself.`);
      }
    }

    // 3. Jalankan Transaksi: Delete Existing & Insert New
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // A. Hapus semua resep lama untuk produk ini
      await manager.delete(ProductRecipeIngredientEntity, { recipeProductUuid: productUuid });

      // B. Masukkan data resep baru
      if (ingredients.length > 0) {
        const newRecipeIngredients = ingredients.map(item => {
          return manager.create(ProductRecipeIngredientEntity, {
            uuid: generateRecipeIngredientUuid(storeUuid),
            recipeProductUuid: productUuid,
            ingredientProductUuid: item.ingredientProductUuid,
            unitUuid: item.unitUuid,
            qty: item.qty,
            createdBy: userId,
          });
        });

        await manager.save(newRecipeIngredients);
      }

      return {
        message: 'Recipe successfully saved/updated.',
        recipeProductUuid: productUuid,
        totalIngredients: ingredients.length,
      };
    });
  }
}