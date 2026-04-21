import { Module } from '@nestjs/common';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { recipeProviders } from '../../common/entities/recipe/recipe.provider';
import { DatabaseModule } from '../../common/db/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RecipeController],
  providers: [...recipeProviders, RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}