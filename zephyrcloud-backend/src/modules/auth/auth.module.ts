import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET') ?? 'dev_secret';

        // JwtModuleOptions expects expiresIn as `number | StringValue`
        // A plain string like "7d" is valid; we cast via `as unknown as`
        // to satisfy strict TS setups that don't infer StringValue.

        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
              '7d') as unknown as number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
