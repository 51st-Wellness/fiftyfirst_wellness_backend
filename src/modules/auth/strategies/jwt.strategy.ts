import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JWT_COOKIE_NAME } from 'src/config/constants.config';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

function cookieExtractor(req: Request): string | null {
  if (req && req.cookies) {
    return req.cookies[JWT_COOKIE_NAME] || null;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: config.get(ENV.JWT_PUBLIC_KEY),
    });
  }

  // Pass through the JWT payload as the user
  async validate(payload: any) {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
