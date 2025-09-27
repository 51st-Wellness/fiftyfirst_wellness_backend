import { configService } from 'src/config/config.service';
import { HelmetOptions } from 'helmet';
import { ENV } from 'src/config/env.enum';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { CUSTOM_HEADERS } from './constants.config';

const HELMET_OPTIONS: HelmetOptions = {
  contentSecurityPolicy: false,
};

const CORS_OPTIONS: CorsOptions = {
  origin: [
    configService.get(ENV.DEVELOPMENT_URL),
    configService.get(ENV.PRODUCTION_URL),
    'http://localhost:3000',
    'http://localhost:3001', //nextjs dev server
    'http://localhost:5173', //react vite dev server
    'http://localhost:4200',
    'https://fifty-firsts-wellness2.vercel.app',
    configService.get(ENV.FRONTEND_URL),
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Access-Control-Expose-Headers',
    ...Object.values(CUSTOM_HEADERS),
  ],
  credentials: true,
};

export const AppConfig = {
  PORT: configService.get(ENV.PORT, '3000'),
  NODE_ENV: configService.get(ENV.NODE_ENV, 'development'),
  CORS_OPTIONS,
  HELMET_OPTIONS,
};
