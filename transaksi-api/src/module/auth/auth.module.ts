import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { DatabaseModule } from 'src/common/db/database.module';
import { userProvider } from 'src/common/entities/user/user.provider';
import { AtStrategy } from 'src/common/strategies/at.strategy';
import { RtStrategy } from 'src/common/strategies/rt.strategy';
import { AuthService } from './auth.service';
import { roleProvider } from 'src/common/entities/role/role.provider';

@Module({
  imports: [
    DatabaseModule, 
    JwtModule.register({}), 
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    AtStrategy, 
    RtStrategy,
    ...userProvider,
    ...roleProvider,
  ],
  exports: [AuthService],
})
export class AuthModule {}