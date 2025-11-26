import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { AppConfig } from 'src/config/app.config';
import helmet from 'helmet';
import { StructuredLoggerService } from 'src/lib/logging/structured-logger.service';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configService.validateEnv();

  // Set up structured logger
  app.useLogger(new StructuredLoggerService(configService));

  // Set up global exception filter
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Keep strict validation globally
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Add cookie parser middleware for JWT cookies
  app.use(cookieParser());

  // Configure JSON body parser with raw body preservation for webhooks
  app.use(
    '/api/payment/webhook',
    json({
      verify: (req: any, res, buf) => {
        // Store raw body for webhook signature verification
        req.rawBody = buf;
      },
    }),
  );

  // Default JSON parser for other routes
  app.use(json());

  app.enableCors(AppConfig.CORS_OPTIONS);
  app.use(helmet(AppConfig.HELMET_OPTIONS));
  // app.use(CorrelationMiddleware);

  app.setGlobalPrefix('api', {
    exclude: ['/docs'],
  });

  await app.listen(AppConfig.PORT);
  console.log(`🚀 API Service running on port ${AppConfig.PORT}`);
  if (configService.get(ENV.NODE_ENV) === 'development') {
    console.log(`
      visit : ${configService.get(ENV.SERVER_URL)}/api`);
  } else {
    console.log(`
      visit : ${configService.get(ENV.FRONTEND_URL)}/api`);
  }
}
bootstrap();
