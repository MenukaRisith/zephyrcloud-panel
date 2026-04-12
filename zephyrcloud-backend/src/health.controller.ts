import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  public constructor(private readonly prisma: PrismaService) {}

  @Get()
  public async getHealth() {
    const databaseReachable = await this.prisma.isDatabaseReachable();
    const payload = {
      status: databaseReachable ? 'ok' : 'degraded',
      service: 'getaeon-backend',
      database: {
        status: databaseReachable ? 'up' : 'down',
      },
    };

    if (!databaseReachable) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}
