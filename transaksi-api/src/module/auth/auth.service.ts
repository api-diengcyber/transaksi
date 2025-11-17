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

// Interface untuk return type Token
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
  // SIGN UP (REGISTER)
  // ============================
  async signup(dto: AuthDto): Promise<Tokens> {
    // 1. Cek apakah username sudah ada
    const userExists = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (userExists) {
      throw new BadRequestException('Username already exists');
    }

    // 2. Hash Password
    const hash = await this.hashData(dto.password);

    // 3. Simpan User ke DB
    const newUser = this.userRepository.create({
      username: dto.username,
      password: hash,
    });
    await this.userRepository.save(newUser);

    // 4. Generate Token (Access & Refresh)
    const tokens = await this.getTokens(newUser.uuid, newUser.username);

    // 5. Simpan Hash dari Refresh Token ke DB
    await this.updateRefreshToken(newUser.uuid, tokens.refreshToken);

    return tokens;
  }

  async signin(dto: AuthDto): Promise<Tokens> {
    // 1. Cari User
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (!user) throw new ForbiddenException('Access Denied');

    // 2. Bandingkan Password
    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) throw new ForbiddenException('Access Denied');

    // 3. Generate Token
    const tokens = await this.getTokens(user.uuid, user.username);

    // 4. Update Refresh Token di DB
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(
        { uuid: userId }, 
        { refreshToken: '' }
    );
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(userId: string, rt: string): Promise<Tokens> {
    // 1. Cari User
    const user = await this.userRepository.findOne({
      where: { uuid: userId },
    });
    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const rtMatches = await bcrypt.compare(rt, user.refreshToken);
    if (!rtMatches) throw new ForbiddenException('Access Denied');

    // 3. Generate Token Baru
    const tokens = await this.getTokens(user.uuid, user.username);

    // 4. Update RT baru di DB
    await this.updateRefreshToken(user.uuid, tokens.refreshToken);

    return tokens;
  }

  // ============================
  // HELPER METHODS
  // ============================

  // Helper untuk Hash Data (Password / Token)
  async hashData(data: string) {
    return bcrypt.hash(data, 10);
  }

  // Helper untuk Update RT di DB
  async updateRefreshToken(userId: string, rt: string) {
    const hash = await this.hashData(rt);
    await this.userRepository.update({ uuid: userId }, { refreshToken: hash });
  }

  // Helper Generate JWT
  async getTokens(userId: string, username: string): Promise<Tokens> {
    const [at, rt] = await Promise.all([
      // Access Token (Expired Cepat: 15 menit)
      this.jwtService.signAsync(
        { sub: userId, username },
        {
          secret: 'at-secret', // Ganti dengan process.env.AT_SECRET nanti
          expiresIn: '15m',
        },
      ),
      // Refresh Token (Expired Lama: 7 hari)
      this.jwtService.signAsync(
        { sub: userId, username },
        {
          secret: 'rt-secret', // Ganti dengan process.env.RT_SECRET nanti
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