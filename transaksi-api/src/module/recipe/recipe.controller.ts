import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsNotEmpty, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { AtGuard } from 'src/common/guards/at.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { RecipeService } from './recipe.service'; 
import { GetStore } from 'src/common/decorators/get-store.decorator';

// --- DTO for Payload ---

class IngredientDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', description: 'UUID Produk Bahan Baku' })
  @IsUUID()
  ingredientProductUuid: string;

  @ApiProperty({ example: 'f1e2d3c4-b5a6-0987-6543-210fedcba987', description: 'UUID Satuan Unit Bahan Baku' })
  @IsUUID()
  unitUuid: string;
  
  @ApiProperty({ example: 0.5, description: 'Jumlah (Quantity) yang dibutuhkan per 1 Produk Jadi' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.0001, { message: 'Quantity harus lebih besar dari 0.' })
  qty: number;
}

export class SaveRecipeDto {
    @ApiProperty({ type: [IngredientDto], description: 'Daftar bahan baku yang dibutuhkan' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IngredientDto)
    ingredients: IngredientDto[];
}

// --- END DTO ---

@ApiTags('Recipe (BOM)')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('recipe')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get(':productUuid')
  @ApiOperation({ summary: 'Get recipe ingredients for a given product (menu)' })
  async getRecipe(
    @Param('productUuid') productUuid: string,
    @GetStore() storeUuid: string,
  ) {
    return this.recipeService.getRecipeByProduct(productUuid, storeUuid);
  }

  @Post('save/:productUuid')
  @ApiOperation({ summary: 'Save/Update recipe ingredients for a product' })
  @ApiBody({ type: SaveRecipeDto })
  async saveRecipe(
    @Param('productUuid') productUuid: string,
    @Body() body: SaveRecipeDto,
    @GetUser('sub') userId: string,
    @GetStore() storeUuid: string,
  ) {
    return this.recipeService.saveRecipe(productUuid, body.ingredients, userId, storeUuid);
  }
}