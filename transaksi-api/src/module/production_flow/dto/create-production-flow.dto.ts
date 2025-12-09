import { IsNotEmpty, IsString, IsInt, IsUUID, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateProductionFlowDto {
    @IsNotEmpty()
    @IsString()
    productionUuid: string;

    @IsNotEmpty()
    @IsString()
    stepName: string;

    @IsNotEmpty()
    @IsInt()
    stepOrder: number;

    @IsOptional()
    @IsString()
    productUuid?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    workerUserUuids?: string[];

    @IsOptional()
    @IsBoolean()
    isCompleted?: boolean;
}