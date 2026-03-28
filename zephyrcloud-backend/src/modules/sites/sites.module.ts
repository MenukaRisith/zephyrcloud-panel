import { Module } from '@nestjs/common';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  imports: [CoolifyModule],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
