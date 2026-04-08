// src/module/auth/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { AtGuard } from 'src/common/guards/at.guard';
import { RtGuard } from 'src/common/guards/rt.guard';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  signin(@Body() dto: AuthDto) {
    return this.authService.signin(dto);
  }

  @UseGuards(AtGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@GetUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  @UseGuards(RtGuard)
  @ApiBearerAuth()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(
    @GetUser('sub') userId: string,
    @GetUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Get('me')
  @UseGuards(AtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dapatkan profil user yang sedang login' })
  getMe(@GetUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }
}