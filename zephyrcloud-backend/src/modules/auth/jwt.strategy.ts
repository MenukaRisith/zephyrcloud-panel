import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import type { JwtPayload } from '../../common/types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  public constructor(config: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      // `ExtractJwt.fromAuthHeaderAsBearerToken` is weakly typed in some CommonJS defs.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev_secret',
    });
  }

  public validate(payload: JwtPayload): JwtPayload {
    // attached to req.user
    return payload;
  }
}
