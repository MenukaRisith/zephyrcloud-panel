import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../common/prisma/prisma.service';

async function bcryptHash(password: string, rounds = 12): Promise<string> {
  return (
    bcrypt as unknown as { hash: (s: string, n: number) => Promise<string> }
  ).hash(password, rounds);
}

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const email = this.readEnv('BOOTSTRAP_ADMIN_EMAIL', true);
    const password = this.readEnv('BOOTSTRAP_ADMIN_PASSWORD');

    if (!email || !password) {
      return;
    }

    const name = this.readEnv('BOOTSTRAP_ADMIN_NAME') || 'Platform Admin';
    const forcePassword =
      this.readEnv('BOOTSTRAP_ADMIN_FORCE_PASSWORD') === 'true';

    try {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          role: true,
          is_active: true,
        },
      });

      const passwordHash =
        forcePassword || !existing ? await bcryptHash(password, 12) : undefined;

      if (!existing) {
        await this.prisma.user.create({
          data: {
            email,
            name,
            password_hash: passwordHash ?? (await bcryptHash(password, 12)),
            role: Role.admin,
            is_active: true,
            tenant_id: null,
          },
        });

        this.logger.log(`Bootstrapped admin user ${email}.`);
        return;
      }

      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          role: Role.admin,
          is_active: true,
          ...(passwordHash ? { password_hash: passwordHash } : {}),
        },
      });

      this.logger.log(
        `Ensured bootstrap admin user ${email} has admin access${forcePassword ? ' and refreshed password' : ''}.`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to bootstrap admin user ${email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private readEnv(name: string, lower = false): string {
    const value = (this.config.get<string>(name) ?? '').trim();
    return lower ? value.toLowerCase() : value;
  }
}
