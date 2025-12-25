import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { AccountCategory } from 'src/common/entities/account/account.entity';

export class CreateAccountDto {
    @IsNotEmpty()
    @IsString()
    @Length(1, 20)
    code: string;

    @IsNotEmpty()
    @IsString()
    @Length(1, 100)
    name: string;

    @IsNotEmpty()
    @IsEnum(AccountCategory)
    category: AccountCategory;

    @IsNotEmpty()
    @IsEnum(['DEBIT', 'CREDIT'])
    normalBalance: 'DEBIT' | 'CREDIT';
}