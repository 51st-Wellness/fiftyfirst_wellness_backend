import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Create the database connection
export function createDatabaseConnection(url: string, authToken?: string) {
  const client = createClient({
    url,
    authToken,
  });

  return drizzle(client, { schema });
}

// Export the database type for dependency injection
export type Database = ReturnType<typeof createDatabaseConnection>;
