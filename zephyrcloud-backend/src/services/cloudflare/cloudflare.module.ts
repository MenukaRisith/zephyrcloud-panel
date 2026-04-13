import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudflareDnsService } from './cloudflare.service';

@Module({
  imports: [ConfigModule],
  providers: [CloudflareDnsService],
  exports: [CloudflareDnsService],
})
export class CloudflareModule {}
