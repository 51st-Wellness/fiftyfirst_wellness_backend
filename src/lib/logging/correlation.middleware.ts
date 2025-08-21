import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  userId?: string | undefined;
  userRole?: string | undefined;
}

// Global async storage for request context
export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || uuidv4();
    const requestId = uuidv4();

    const context: RequestContext = {
      correlationId,
      requestId,
      startTime: Date.now(),
      userId: (req.user as any).id,
      userRole: (req.user as any)?.role,
    };

    // Set response headers
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);

    // Store in async local storage
    asyncLocalStorage.run(context, () => {
      next();
    });
  }
}
