import { Module } from '@nestjs/common';
import { CloudflareModule } from '../../services/cloudflare/cloudflare.module';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { SitesModule } from '../sites/sites.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CloudflareModule, CoolifyModule, SitesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
