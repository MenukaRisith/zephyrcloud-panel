import { Module } from '@nestjs/common';
import { CloudflareModule } from '../../services/cloudflare/cloudflare.module';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { GithubModule } from '../github/github.module';
import { SitesController } from './sites.controller';
import { DomainAutomationService } from './domain-automation.service';
import { DomainVerificationService } from './domain-verification.service';
import { SitesService } from './sites.service';

@Module({
  imports: [CoolifyModule, GithubModule, CloudflareModule],
  controllers: [SitesController],
  providers: [SitesService, DomainVerificationService, DomainAutomationService],
  exports: [SitesService],
})
export class SitesModule {}
