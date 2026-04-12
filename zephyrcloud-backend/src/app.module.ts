import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './common/prisma/prisma.module';
import { AdminBootstrapService } from './bootstrap/admin-bootstrap.service';
import { AuthModule } from './modules/auth/auth.module';
import { SitesModule } from './modules/sites/sites.module';
import { HealthController } from './health.controller';

import { CoolifyModule } from './services/coolify/coolify.module';
import { AdminModule } from './modules/admin/admin.module';
import { GithubModule } from './modules/github/github.module';

@Module({
  imports: [
    // Loads .env and makes ConfigService globally available
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),

    // Global PrismaService
    PrismaModule,

    // Auth (register/login)
    AuthModule,

    SitesModule,
    CoolifyModule,
    AdminModule,
    GithubModule,
  ],
  controllers: [HealthController],
  providers: [AdminBootstrapService],
})
export class AppModule {}
