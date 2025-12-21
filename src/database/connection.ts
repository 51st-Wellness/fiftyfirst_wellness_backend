import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Create the database connection
export function createDatabaseConnection(url: string) {
  const pool = new Pool({
    connectionString: url,
  });

  return drizzle(pool, { schema });
}

// Export the database type for dependency injection
export type Database = ReturnType<typeof createDatabaseConnection>;
