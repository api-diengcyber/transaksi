import {
  Injectable,
  Inject,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
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
    @Inject('USER_REPOSITORY')
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {}

  // ============================
  // SIGN IN (LOGIN)
  // ============================
  async signin(dto: AuthDto): Promise<Tokens> {
    // 1. Cari User beserta Default Store-nya
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
      relations: ['defaultStore'], // <--- Load Relasi Default Store
    });

    if (!user) throw new ForbiddenException('Access Denied');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new ForbiddenException('Access Denied');

    // 2. Ambil Store UUID (Jika ada)
    const storeUuid = user.defaultStore ? user.defaultStore.uuid : null;

    // 3. Generate Token dengan Store UUID
    const tokens = await this.getTokens(user.uuid, user.username, storeUuid);
    
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(
        { uuid: userId }, 
        { refreshToken: '' } // Pastikan nullable
    );
    return { message: 'Logged out successfully' };
  }

  // ============================
  // REFRESH TOKEN
  // ============================
  // [UPDATED] Terima parameter storeUuid dari token lama
  async refreshTokens(userId: string, rt: string, storeUuid: string | null): Promise<Tokens> {
    const user = await this.userRepository.findOne({
      where: { uuid: userId },
    });
    
    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    // Generate Token Baru dengan Store UUID yang SAMA dengan sebelumnya
    const tokens = await this.getTokens(user.uuid, user.username, storeUuid);
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  // ... Helper hashData & updateRefreshToken SAMA ...
  async updateRefreshToken(userId: string, rt: string) {
    const hash = await this.hashData(rt);
    await this.userRepository.update({ uuid: userId }, { refreshToken: hash });
  }
  
  async hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  // ============================
  // GET TOKENS (MODIFIED)
  // ============================
  async getTokens(userId: string, username: string, storeUuid: string | null): Promise<Tokens> {
    // Payload sekarang memuat storeUuid
    const payload = {
        sub: userId,
        username,
        storeUuid // <--- Tambahkan ini
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        payload,
        {
          secret: 'at-secret', 
          expiresIn: '15m',
        },
      ),
      this.jwtService.signAsync(
        payload, // Refresh token juga membawa info store agar konsisten saat refresh
        {
          secret: 'rt-secret', 
          expiresIn: '7d',
        },
      ),
    ]);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }
}