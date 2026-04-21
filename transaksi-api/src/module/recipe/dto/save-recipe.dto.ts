import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class IngredientItemDto {
  @IsString()
  @IsNotEmpty()
  ingredientProductUuid: string;

  @IsString()
  @IsNotEmpty()
  unitUuid: string;

  @IsNumber()
  @IsNotEmpty()
  qty: number;
}

export class SaveRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientItemDto)
  ingredients: IngredientItemDto[];
}