import { Module } from '@nestjs/common';
import { CoolifyClient } from './coolify.client';
import { CoolifyService } from './coolify.service';

@Module({
  providers: [CoolifyClient, CoolifyService],
  exports: [CoolifyService],
})
export class CoolifyModule {}
