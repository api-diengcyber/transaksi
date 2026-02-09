

export const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
export const generateStoreUuid = () => `STR-${generateLocalUuid()}`;
export const generateUserUuid = (storeUuid: string) => `${storeUuid}-USR-${generateLocalUuid()}`;
export const generateStoreSettingUuid = (storeUuid: string) => `${storeUuid}-STG-${generateLocalUuid()}`;
export const generateUserRoleUuid = (storeUuid: string) => `${storeUuid}-ROLE-${generateLocalUuid()}`;
// export const generateShelveUuid = (storeUuid: string) => `${storeUuid}-SHL-${generateLocalUuid()}`;
export const generateCategoryUuid = (storeUuid: string) => `${storeUuid}-CAT-${generateLocalUuid()}`;
export const generateJournalDetailUuid = (storeUuid: string) => `${storeUuid}-JDT-${generateLocalUuid()}`;
export const generateProductionDetailUuid = (storeUuid: string) => `${storeUuid}-PRDN-${generateLocalUuid()}`;
export const generateRecipeIngredientUuid = (storeUuid: string) => `${storeUuid}-RCI-${generateLocalUuid()}`;
export const generateTableUuid = (storeUuid: string) => `${storeUuid}-TBL-${generateLocalUuid()}`;