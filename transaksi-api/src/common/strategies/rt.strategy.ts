import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ForbiddenException, Injectable } from '@nestjs/common'; // Tambah ForbiddenException

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'rt-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: any) {
    const authHeader = req.get('authorization');
    if (!authHeader) throw new ForbiddenException('Refresh token malformed');
    const refreshToken = authHeader.replace('Bearer', '').trim();
    return {
      ...payload,
      refreshToken,
    };
  }
}