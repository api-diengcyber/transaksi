import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AtGuard } from 'src/common/guards/at.guard';
import { GetStore } from 'src/common/decorators/get-store.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@UseGuards(AtGuard)
@Controller('account')
export class AccountController {
    constructor(private readonly accountService: AccountService) { }

    @Post()
    create(@GetStore() storeUuid: string, @Body() createAccountDto: CreateAccountDto) {
        return this.accountService.create(storeUuid, createAccountDto);
    }

    @Get()
    findAll(@GetStore() storeUuid: string) {
        return this.accountService.getAllAccounts(storeUuid);
    }

    @Get('categories')
    getCategories() {
        return this.accountService.getAccountCategories();
    }

    @Get(':uuid')
    findOne(@GetStore() storeUuid: string, @Param('uuid') uuid: string) {
        return this.accountService.findOne(storeUuid, uuid);
    }

    @Patch(':uuid')
    update(
        @GetStore() storeUuid: string,
        @Param('uuid') uuid: string,
        @Body() updateAccountDto: UpdateAccountDto
    ) {
        return this.accountService.update(storeUuid, uuid, updateAccountDto);
    }

    @Delete(':uuid')
    remove(@GetStore() storeUuid: string, @Param('uuid') uuid: string) {
        return this.accountService.remove(storeUuid, uuid);
    }

    @Get('report/financial')
    async getFinancialReport(
        @GetStore() storeUuid: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const end = endDate || new Date().toISOString();
        return this.accountService.getFinancialReport(storeUuid, start, end);
    }
}