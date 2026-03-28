import { Module } from '@nestjs/common';
import { CoolifyModule } from '../../services/coolify/coolify.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CoolifyModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
