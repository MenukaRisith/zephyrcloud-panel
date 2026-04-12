import { Module } from '@nestjs/common';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { SitesModule } from '../sites/sites.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CoolifyModule, SitesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
