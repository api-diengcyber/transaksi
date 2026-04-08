// src/module/auth/auth.service.ts
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from 'src/common/entities/user/user.entity';
import { AuthDto } from './dto/auth.dto';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATA_SOURCE') 
    private dataSource: DataSource,
    @Inject('USER_REPOSITORY')
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {}

  async signin(dto: AuthDto): Promise<Tokens> {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (!user) throw new ForbiddenException('Access Denied');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new ForbiddenException('Access Denied');

    // HAPUS logika ambil default store. Token murni user.
    const tokens = await this.getTokens(user.uuid, user.username);
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(
        { uuid: userId }, 
        { refreshToken: "" } 
    );
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: string, rt: string): Promise<Tokens> {
    const user = await this.userRepository.findOne({
      where: { uuid: userId },
    });
    
    if (!user || !user.refreshToken) throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    // Generate token baru tanpa storeUuid
    const tokens = await this.getTokens(user.uuid, user.username);
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  async updateRefreshToken(userId: string, rt: string) {
    const hash = await this.hashData(rt);
    await this.userRepository.update({ uuid: userId }, { refreshToken: hash });
  }
  
  async hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  // REVISI: Hapus storeUuid dari payload
  async getTokens(userId: string, username: string): Promise<Tokens> {
    const payload = {
        sub: userId,
        username,
        // storeUuid dihapus dari sini agar token reusable antar toko
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, { secret: 'at-secret', expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { secret: 'rt-secret', expiresIn: '7d' }),
    ]);

    return { accessToken: at, refreshToken: rt };
  }

  // --- [BARU] Logika untuk mengambil data profil ---
  async getMe(userId: string) {
    const userRepo = this.dataSource.getRepository(UserEntity);
    
    // Cari user berdasarkan ID dan ambil relasi yang penting
    const user = await userRepo.findOne({
      where: { uuid: userId },
      relations: ['roles', 'defaultStore', 'stores'], 
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan di sistem');
    }

    // Hilangkan informasi sensitif sebelum dikembalikan ke Frontend
    const { password, ...result } = user;
    
    // Opsional: Sederhanakan format roles (dari array object menjadi array string)
    // jika frontend membutuhkannya dalam format string array.
    // result.roles = user.roles.map(r => r.role);

    return result;
  }
}