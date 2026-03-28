import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/types/auth.types';
import { CoolifyService } from '../../services/coolify/coolify.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/coolify')
export class AdminController {
  public constructor(private readonly coolify: CoolifyService) {}

  @Get('health')
  public async health(@CurrentUser() user: JwtPayload) {
    // MVP: only admins
    if (user.role !== 'admin') {
      return { ok: false, error: 'Admin only' };
    }
    return await this.coolify.health();
  }
}
