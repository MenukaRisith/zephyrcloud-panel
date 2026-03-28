import { Module } from '@nestjs/common';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CoolifyModule],
  controllers: [AdminController],
})
export class AdminModule {}
