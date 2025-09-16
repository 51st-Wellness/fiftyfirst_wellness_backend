import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { createDatabaseConnection } from '../src/database/connection';
import * as schema from '../src/database/schema';

async function clearDatabase() {
  console.log('🗑️ Clearing database...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = createDatabaseConnection(
    process.env.DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
  );

  const tableNames = Object.values(schema)
    .map((table: any) => table?.dbName)
    .filter(Boolean);

  for (const tableName of tableNames) {
    try {
      await db.run(sql.raw(`DROP TABLE IF EXISTS ${tableName};`));
      console.log(`- Dropped table: ${tableName}`);
    } catch (error) {
      console.error(`- Failed to drop table ${tableName}:`, error);
    }
  }

  console.log('✅ Database cleared successfully');
}

// Example of how to run it
if (require.main === module) {
  (async () => {
    try {
      await clearDatabase();
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to clear database:', error);
      process.exit(1);
    }
  })();
}
