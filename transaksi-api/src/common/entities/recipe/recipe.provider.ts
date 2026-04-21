import { DataSource } from 'typeorm';
import { RecipeEntity } from './recipe.entity';

export const recipeProviders = [
  {
    provide: 'RECIPE_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(RecipeEntity),
    inject: ['DATA_SOURCE'],
  },
];