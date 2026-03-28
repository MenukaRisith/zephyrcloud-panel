import { Module } from '@nestjs/common';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { GithubModule } from '../github/github.module';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  imports: [CoolifyModule, GithubModule],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
