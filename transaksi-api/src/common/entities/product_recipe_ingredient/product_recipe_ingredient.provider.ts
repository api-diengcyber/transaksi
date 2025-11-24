import { DataSource } from 'typeorm';
import { ProductRecipeIngredientEntity } from './product_recipe_ingredient.entity';

export const productRecipeIngredientProvider = [
  {
    provide: 'PRODUCT_RECIPE_INGREDIENT_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(ProductRecipeIngredientEntity),
    inject: ['DATA_SOURCE'],
  },
];