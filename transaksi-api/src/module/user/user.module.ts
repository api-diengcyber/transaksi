import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/db/database.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { userProvider } from 'src/common/entities/user/user.provider';
import { userRoleProvider } from 'src/common/entities/user_role/user_role.provider';
import { storeProvider } from 'src/common/entities/store/store.provider'; // Diperlukan di UserService

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [
    ...userProvider,
    ...userRoleProvider,
    ...storeProvider,
    UserService,
  ],
  exports: [UserService],
})
export class UserModule {}