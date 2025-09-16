import 'dotenv/config';
import { reset } from 'drizzle-seed';
import { createDatabaseConnection } from '../src/database/connection'; // Your Drizzle database instance
import * as schema from '../src/database/schema'; // Your Drizzle schema definition

async function clearDatabase() {
  console.log('🗑️ Clearing database...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const db = createDatabaseConnection(
    process.env.DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
  );

  await reset(db, schema);
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
