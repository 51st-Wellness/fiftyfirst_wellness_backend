import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/modules/user/user.module';
import { ConfigModule } from 'src/config/config.module';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { JWT_SYMBOL } from 'src/config/constants.config';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    // CommonModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get(ENV.JWT_PRIVATE_KEY),
        publicKey: config.get(ENV.JWT_PUBLIC_KEY),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: '1h',
        },
        verifyOptions: {
          algorithms: ['RS256'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    {
      provide: JWT_SYMBOL,
      useExisting: JwtService,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
