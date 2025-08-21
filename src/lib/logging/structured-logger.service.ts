import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import * as winston from 'winston';
import { WinstonConfigFactory } from './winston.config';
import { LogContext, StructuredLogEntry } from './logging.types';
import { asyncLocalStorage } from './correlation.middleware';
import { SensitiveDataFilter } from './sensitive-data-filter';
import { ENV } from 'src/config/env.enum';

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly serviceName: string;
  private context?: string;

  constructor(private configService: ConfigService) {
    this.serviceName = this.configService.get(ENV.APP_NAME)!;

    this.logger = WinstonConfigFactory.create({
      service: this.serviceName,
      environment: this.configService.get(ENV.NODE_ENV, 'development'),
      logLevel: this.configService.get(ENV.LOG_LEVEL, 'info'),
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  private buildLogEntry(
    level: string,
    message: string,
    data?: any,
    error?: Error,
  ): StructuredLogEntry {
    const requestContext = asyncLocalStorage.getStore();
    const timestamp = new Date().toISOString();

    const logContext: LogContext = {
      service: this.serviceName,
      ...(requestContext?.correlationId && {
        correlationId: requestContext.correlationId,
      }),
      ...(requestContext?.requestId && { requestId: requestContext.requestId }),
      ...(requestContext?.userId && { userId: requestContext.userId }),
      ...(this.context && { component: this.context }),
    };

    const entry: StructuredLogEntry = {
      timestamp,
      level,
      message,
      context: logContext,
    };

    if (data) {
      entry.data = SensitiveDataFilter.filterObject(data);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
        ...((error as any).code && { code: (error as any).code }),
      };
    }

    return entry;
  }

  log(message: string, data?: any) {
    const entry = this.buildLogEntry('info', message, data);
    this.logger.info(entry);
  }

  error(message: string, error?: Error | string, data?: any) {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const entry = this.buildLogEntry('error', message, data, errorObj);
    this.logger.error(entry);
  }

  warn(message: string, data?: any) {
    const entry = this.buildLogEntry('warn', message, data);
    this.logger.warn(entry);
  }

  debug(message: string, data?: any) {
    const entry = this.buildLogEntry('debug', message, data);
    this.logger.debug(entry);
  }

  verbose(message: string, data?: any) {
    const entry = this.buildLogEntry('verbose', message, data);
    this.logger.verbose(entry);
  }

  // Business event logging
  logBusinessEvent(
    event: string,
    entity: string,
    entityId: string,
    action: string,
    data?: any,
  ) {
    const entry = this.buildLogEntry('info', `Business Event: ${event}`, data);
    entry.business = { event, entity, entityId, action };
    this.logger.info(entry);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, data?: any) {
    const entry = this.buildLogEntry('info', `Performance: ${operation}`, data);
    entry.performance = {
      duration,
      memoryUsage: process.memoryUsage(),
    };
    this.logger.info(entry);
  }

  // Request/Response logging
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    data?: any,
  ) {
    const entry = this.buildLogEntry(
      'info',
      `${method} ${url} - ${statusCode}`,
      data,
    );
    entry.context.method = method;
    entry.context.endpoint = url;
    entry.performance = { duration };
    this.logger.info(entry);
  }
}
