import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { JsonSerializerInterceptor } from './common/interceptors/json-serializer.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  // Security headers (helmet is fully typed once @types/helmet + esModuleInterop is set)
  app.use(helmet());

  // Cookies (typed once @types/cookie-parser is installed)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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

  // Global Interceptor for BigInt serialization
  app.useGlobalInterceptors(new JsonSerializerInterceptor());

  // CORS (adjust origins later)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 8000;
  await app.listen(port);
  console.log(`✅ API running at http://localhost:${port}/api`);
}

// satisfy no-floating-promises
void bootstrap();
