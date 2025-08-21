export interface LogContext {
  correlationId?: string;
  userId?: string;
  driverId?: string;
  tripId?: string;
  vehicleId?: string;
  sessionId?: string;
  requestId?: string;
  service: string;
  method?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: LogContext;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  business?: {
    event: string;
    entity: string;
    entityId: string;
    action: string;
  };
}
