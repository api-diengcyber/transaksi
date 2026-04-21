import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RecipeEntity } from '../../common/entities/recipe/recipe.entity';
import { SaveRecipeDto } from './dto/save-recipe.dto';

@Injectable()
export class RecipeService {
  constructor(
    @Inject('RECIPE_REPOSITORY')
    private readonly recipeRepo: Repository<RecipeEntity>,
  ) {}

  // Mengambil daftar bahan baku berdasarkan UUID Produk Jadi
  async getRecipeByProduct(storeUuid: string, productUuid: string) {
    const ingredients = await this.recipeRepo.find({
      where: { storeUuid, productUuid },
      select: ['ingredientProductUuid', 'unitUuid', 'qty'],
    });

    return { ingredients };
  }

  // Menyimpan/memperbarui resep
  async saveRecipe(storeUuid: string, productUuid: string, dto: SaveRecipeDto) {
    // 1. Hapus semua resep lama yang terhubung dengan produk ini
    await this.recipeRepo.delete({ storeUuid, productUuid });

    // 2. Siapkan data resep baru jika array ingredients tidak kosong
    if (dto.ingredients && dto.ingredients.length > 0) {
      const newRecipes = dto.ingredients.map(ing => {
        return this.recipeRepo.create({
          storeUuid,
          productUuid,
          ingredientProductUuid: ing.ingredientProductUuid,
          unitUuid: ing.unitUuid,
          qty: ing.qty,
        });
      });

      // 3. Simpan massal (Bulk Insert)
      await this.recipeRepo.save(newRecipes);
    }

    return { message: 'Resep berhasil disimpan' };
  }
}