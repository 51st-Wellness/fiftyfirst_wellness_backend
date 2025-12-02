// One-off script to backfill Product rows for existing StoreItems
// Run with: pnpm tsx scripts/backfill-store-products.ts

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { ENV } from '../src/config/env.enum';
import { createDatabaseConnection } from '../src/database/connection';

async function main() {
  // Resolve database connection details from env
  const databaseUrl = process.env[ENV.DATABASE_URL];
  const tursoAuthToken = process.env[ENV.TURSO_AUTH_TOKEN];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const db = createDatabaseConnection(databaseUrl, tursoAuthToken);

  console.log('🔄 Starting backfill for missing Product rows from StoreItem...');

  // Insert Product rows for any StoreItem.productId that does not yet exist in Product
  await db.run(sql`
    INSERT INTO "Product" (id, type, pricingModel, createdAt, updatedAt)
    SELECT
      s.productId,
      'STORE',
      'ONE_TIME',
      CAST(strftime('%s','now') AS INTEGER) * 1000,
      CAST(strftime('%s','now') AS INTEGER) * 1000
    FROM "StoreItem" s
    LEFT JOIN "Product" p ON p.id = s.productId
    WHERE p.id IS NULL
  `);

  console.log('✅ Backfill complete. All StoreItems now have corresponding Product rows.');
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});


