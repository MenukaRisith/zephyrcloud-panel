import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  public async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  public async onModuleDestroy(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.$disconnect();
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to disconnect Prisma cleanly: ${this.formatError(error)}`,
      );
    } finally {
      this.isConnected = false;
    }
  }

  public async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.isConnected = true;
      return true;
    } catch (error: unknown) {
      this.isConnected = false;
      this.logger.warn(
        `Database health check failed: ${this.formatError(error)}`,
      );
      return false;
    }
  }

  private async connectWithRetry(
    maxAttempts = 3,
    retryDelayMs = 1_500,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.logger.log('Prisma connected successfully.');
        return;
      } catch (error: unknown) {
        this.isConnected = false;
        const message = this.formatError(error);

        if (attempt === maxAttempts) {
          this.logger.warn(
            `Initial Prisma connection failed after ${maxAttempts} attempts: ${message}. Starting in degraded mode.`,
          );
          return;
        }

        this.logger.warn(
          `Initial Prisma connection attempt ${attempt}/${maxAttempts} failed: ${message}. Retrying in ${retryDelayMs}ms.`,
        );
        await this.sleep(retryDelayMs);
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
