import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { AppConfig } from 'src/config/app.config';
import helmet from 'helmet';
import { StructuredLoggerService } from 'src/lib/logging/structured-logger.service';
import { ValidationPipe } from '@nestjs/common';

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
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

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
      visit : ${configService.get(ENV.DEVELOPMENT_URL)}/api`);
  } else {
    console.log(`
      visit : ${configService.get(ENV.PRODUCTION_URL)}/api`);
  }
}
bootstrap();
