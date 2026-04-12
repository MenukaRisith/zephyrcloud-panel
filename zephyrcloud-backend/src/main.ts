import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { PrismaAvailabilityExceptionFilter } from './common/filters/prisma-availability-exception.filter';
import { JsonSerializerInterceptor } from './common/interceptors/json-serializer.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  // Security headers (helmet is fully typed once @types/helmet + esModuleInterop is set)
  app.use(helmet());

  // Cookies (typed once @types/cookie-parser is installed)
  app.use(cookieParser());

  // Prefix
  app.setGlobalPrefix('api');

  // DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaAvailabilityExceptionFilter());

  // Global Interceptor for BigInt serialization
  app.useGlobalInterceptors(new JsonSerializerInterceptor());

  // CORS (adjust origins later)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const rawPort = config.get<string>('PORT') ?? '8000';
  const port = Number.parseInt(rawPort, 10);
  await app.listen(Number.isFinite(port) ? port : 8000, '0.0.0.0');
  console.log(`✅ API running at http://localhost:${port}/api`);
}

// satisfy no-floating-promises
void bootstrap();
