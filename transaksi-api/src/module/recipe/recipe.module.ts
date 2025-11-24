import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { ProductModule } from '../product/product.module'; 
import { productRecipeIngredientProvider } from 'src/common/entities/product_recipe_ingredient/product_recipe_ingredient.provider';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';

@Module({
  imports: [
    DatabaseModule,
    ProductModule 
  ],
  controllers: [RecipeController],
  providers: [
    ...productRecipeIngredientProvider,
    RecipeService,
  ],
  exports: [RecipeService],
})
export class RecipeModule {}