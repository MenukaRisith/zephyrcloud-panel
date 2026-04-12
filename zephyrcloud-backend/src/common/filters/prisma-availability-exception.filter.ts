import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

type ErrorResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaAvailabilityExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaAvailabilityExceptionFilter.name);

  public override catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientInitializationError,
    host: ArgumentsHost,
  ): void {
    if (this.isDatabaseAvailabilityError(exception)) {
      this.logger.error(`Database unavailable: ${exception.message}`);

      const response = host.switchToHttp().getResponse<ErrorResponse>();
      response.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Database unavailable. Please try again shortly.',
      });
      return;
    }

    super.catch(exception as Error, host);
  }

  private isDatabaseAvailabilityError(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientInitializationError,
  ): boolean {
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return true;
    }

    return ['P1001', 'P1002', 'P1008'].includes(exception.code);
  }
}
