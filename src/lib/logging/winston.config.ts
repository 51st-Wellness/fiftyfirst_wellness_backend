import * as winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

export interface WinstonConfig {
  service: string;
  environment: string;
  logLevel: string;
  enableCloudWatch?: boolean;
  enableElasticsearch?: boolean;
}

export class WinstonConfigFactory {
  static create(config: WinstonConfig): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport for development
    if (config.environment === 'development') {
      transports.push(
        new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp(),
            errors({ stack: true }),
            printf(({ timestamp, level, message, context, ...meta }) => {
              const correlationId = (context as any)?.correlationId || 'no-correlation';
              return `${timestamp} [${level.toUpperCase()}] [${correlationId}] ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          )
        })
      );
    } else {
      // JSON format for production (CloudWatch compatibility)
      transports.push(
        new winston.transports.Console({
          format: combine(
            timestamp(),
            errors({ stack: true }),
            json()
          )
        })
      );
    }

    // File transport for persistent logging
    if (config.environment !== 'test') {
      transports.push(
        new winston.transports.File({
          filename: `logs/${config.service}-error.log`,
          level: 'error',
          format: combine(timestamp(), errors({ stack: true }), json())
        }),
        new winston.transports.File({
          filename: `logs/${config.service}-combined.log`,
          format: combine(timestamp(), errors({ stack: true }), json())
        })
      );
    }

    return winston.createLogger({
      level: config.logLevel,
      defaultMeta: {
        service: config.service,
        environment: config.environment
      },
      transports,
      // Don't exit on handled exceptions
      exitOnError: false
    });
  }
}