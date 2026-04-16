

export const generateLocalUuid = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
export const generateStoreUuid = () => `STR-${generateLocalUuid()}`;
export const generateUserUuid = (storeUuid: string) => `${storeUuid}-USR-${generateLocalUuid()}`;
export const generateStoreSettingUuid = (storeUuid: string) => `${storeUuid}-STG-${generateLocalUuid()}`;
export const generateUserRoleUuid = (storeUuid: string) => `${storeUuid}-ROLE-${generateLocalUuid()}`;
export const generateBankUuid = (storeUuid: string) => `${storeUuid}-BNK-${generateLocalUuid()}`;
export const generateShelveUuid = (storeUuid: string) => `${storeUuid}-SHL-${generateLocalUuid()}`;
export const generateWarehouseUuid = (storeUuid: string) => `${storeUuid}-WRH-${generateLocalUuid()}`;
export const generateCategoryUuid = (storeUuid: string) => `${storeUuid}-CAT-${generateLocalUuid()}`;
export const generateUnitUuid = (storeUuid: string) => `${storeUuid}-UNT-${generateLocalUuid()}`;
export const generateJournalConfigUuid = (storeUuid: string) => `${storeUuid}-JCG-${generateLocalUuid()}`;
export const generateJournalDetailUuid = (storeUuid: string) => `${storeUuid}-JDT-${generateLocalUuid()}`;
export const generateProductionDetailUuid = (storeUuid: string) => `${storeUuid}-PRDN-${generateLocalUuid()}`;
export const generateRecipeIngredientUuid = (storeUuid: string) => `${storeUuid}-RCI-${generateLocalUuid()}`;
export const generateTableUuid = (storeUuid: string) => `${storeUuid}-TBL-${generateLocalUuid()}`;
export const generateProductUuid = (storeUuid: string) => `${storeUuid}-PRC-${generateLocalUuid()}`;
export const generateVariantUuid = (storeUuid: string) => `${storeUuid}-VRN-${generateLocalUuid()}`;
export const generatePriceUuid = (storeUuid: string) => `${storeUuid}-PRC-${generateLocalUuid()}`;
export const generatePriceGroupUuid = (storeUuid: string) => `${storeUuid}-PRCGRP-${generateLocalUuid()}`;
export const generateBrandUuid = (storeUuid: string) => `${storeUuid}-BRD-${generateLocalUuid()}`;
export const generateAccountUuid = (storeUuid: string) => `${storeUuid}-ACT\-${generateLocalUuid()}`;
export const generatePaymentMethodUuid = (storeUuid: string) => `${storeUuid}-PAYMTD\-${generateLocalUuid()}`;
export const generatePromoUuid = (storeUuid: string) => `${storeUuid}-PRO\-${generateLocalUuid()}`;