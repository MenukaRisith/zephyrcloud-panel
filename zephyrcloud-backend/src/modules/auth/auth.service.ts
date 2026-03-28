import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../../common/types/auth.types';
import { PrismaService } from '../../common/prisma/prisma.service';

import * as bcrypt from 'bcrypt';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Provide narrow, typed wrappers around bcrypt CJS defs so linters/types are happy
async function bcryptHash(password: string, rounds = 12): Promise<string> {
  return (
    bcrypt as unknown as { hash: (s: string, n: number) => Promise<string> }
  ).hash(password, rounds);
}

async function bcryptCompare(a: string, b: string): Promise<boolean> {
  return (
    bcrypt as unknown as { compare: (a: string, b: string) => Promise<boolean> }
  ).compare(a, b);
}

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  tenantName?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

@Injectable()
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async acceptPendingSiteInvitesForUser(
    userId: bigint,
    email: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const invites = await this.prisma.siteInvite.findMany({
      where: {
        email: normalizedEmail,
        status: 'pending',
      },
      select: {
        id: true,
        site_id: true,
        role: true,
      },
    });

    if (!invites.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const invite of invites) {
        await tx.siteMember.upsert({
          where: {
            site_id_user_id: {
              site_id: invite.site_id,
              user_id: userId,
            },
          },
          update: {
            role: invite.role,
            invited_by_user_id: null,
          },
          create: {
            site_id: invite.site_id,
            user_id: userId,
            role: invite.role,
          },
        });

        await tx.siteInvite.update({
          where: { id: invite.id },
          data: {
            status: 'accepted',
            accepted_by_user_id: userId,
            accepted_at: new Date(),
          },
        });
      }
    });
  }

  public async register(input: RegisterInput) {
    const email = input.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcryptHash(input.password, 12);

    let tenantId: bigint | null = null;

    if (input.tenantName && input.tenantName.trim().length > 0) {
      const baseSlug = slugify(input.tenantName);
      let slug = baseSlug || `tenant-${Date.now()}`;

      let i = 1;
      // Ensure slug uniqueness
      while (true) {
        const found = await this.prisma.tenant.findUnique({ where: { slug } });
        if (!found) break;
        slug = `${baseSlug}-${i++}`;
      }

      const tenant = await this.prisma.tenant.create({
        data: {
          name: input.tenantName.trim(),
          slug,
        },
      });

      tenantId = tenant.id;
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        password_hash: passwordHash,
        tenant_id: tenantId,
        role: 'user',
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenant_id: true,
      },
    });

    await this.acceptPendingSiteInvitesForUser(user.id, user.email);

    const accessToken = await this.jwt.signAsync({
      sub: user.id.toString(),
      email: user.email,
      role: user.role as Role,
      tenant_id: user.tenant_id ? user.tenant_id.toString() : null,
    });

    return {
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id ? user.tenant_id.toString() : null,
      },
      accessToken,
    };
  }

  public async login(input: LoginInput) {
    const email = input.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcryptCompare(input.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    await this.acceptPendingSiteInvitesForUser(user.id, user.email);

    const accessToken = await this.jwt.signAsync({
      sub: user.id.toString(),
      email: user.email,
      role: user.role as Role,
      tenant_id: user.tenant_id ? user.tenant_id.toString() : null,
    });

    return {
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id ? user.tenant_id.toString() : null,
      },
      accessToken,
    };
  }
}
