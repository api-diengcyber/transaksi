import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { SaveRecipeDto } from './dto/save-recipe.dto';
import { AtGuard } from '../../common/guards/at.guard';
import { GetStore } from '../../common/decorators/get-store.decorator';

@UseGuards(AtGuard)
@Controller('recipe')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get(':productUuid')
  getRecipe(
    @GetStore() storeUuid: string,
    @Param('productUuid') productUuid: string,
  ) {
    return this.recipeService.getRecipeByProduct(storeUuid, productUuid);
  }

  @Post('/save/:productUuid')
  saveRecipe(
    @GetStore() storeUuid: string,
    @Param('productUuid') productUuid: string,
    @Body() dto: SaveRecipeDto,
  ) {
    return this.recipeService.saveRecipe(storeUuid, productUuid, dto);
  }
}