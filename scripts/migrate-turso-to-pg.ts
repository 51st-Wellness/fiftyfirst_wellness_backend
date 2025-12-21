import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../src/database/schema';
import 'dotenv/config';

// explicit manual mapping if needed, or just iterate schema
// Since schema.ts is now Postgres-typed, we might need a dynamic approach
// or just selecting raw data.

async function migrate() {
  console.log('🚀 Starting Turso -> Postgres Migration...');

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  const postgresUrl = process.env.DATABASE_URL;

  if (!tursoUrl || !tursoAuthToken || !postgresUrl) {
    throw new Error(
      'Missing environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, or DATABASE_URL',
    );
  }

  // Source (Turso)
  const turso = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  // Destination (Postgres)
  const pool = new Pool({ connectionString: postgresUrl });
  const dbPg = drizzlePg(pool, { schema });

  // Table List (Order matters for foreign keys!)
  const tables = [
    'User',
    'PasswordResetOTP',
    'EmailVerificationOTP',
    'SubscriptionPlan',
    'SubscriptionAccess',
    'Payment',
    'Subscription',
    'Product',
    'StoreItem',
    'Programme',
    'Podcast',
    'DeliveryAddress',
    'Order',
    'OrderItem',
    'Review',
    'CartItem',
    'Bookmark',
    'AIConversation',
    'Category',
    'ProductSubscriber',
    'Setting',
    'Blogs',
  ];

  for (const tableName of tables) {
    console.log(`\n📦 Migrating table: ${tableName}`);

    let rows;
    try {
      // Read from Turso
      const result = await turso.execute(`SELECT * FROM "${tableName}"`);
      rows = result.rows;
      console.log(`   Found ${rows.length} rows in Turso.`);
    } catch (e) {
      console.log(
        `   ⚠️ Could not read from Turso table ${tableName}: ${e.message}`,
      );
      continue;
    }

    if (rows.length === 0) continue;

    // Transform and Insert
    const chunk = 50;
    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      const formattedBatch = batch.map((row) => {
        const newRow: any = { ...row };

        for (const key in newRow) {
          // Common boolean fields based on schema
          // If SQLite stored 0/1, convert to boolean
          const boolColumns = [
            'isActive',
            'isEmailVerified',
            'autoRenew',
            'isPreOrderPayment',
            'isFeatured',
            'isPublished',
            'discountActive',
            'preOrderEnabled',
            'isDefault',
            'isPreOrder',
            'isEditable',
          ];
          if (boolColumns.includes(key)) {
            if (newRow[key] === 0) newRow[key] = false;
            if (newRow[key] === 1) newRow[key] = true;
          }

          // JSON fields: Turso might return stringified JSON
          const jsonColumns = [
            'metadata',
            'productIngredients',
            'display',
            'images',
            'categories',
            'parcelDimensions',
            'statusHistory',
            'messages',
          ];
          if (jsonColumns.includes(key)) {
            if (typeof newRow[key] === 'string') {
              try {
                newRow[key] = JSON.parse(newRow[key]);
              } catch (e) {
                // keep as is
              }
            }
          }

          // Timestamps: Turso often stores as Integer (ms). Postgres expects Date.
          const dateColumns = [
            'createdAt',
            'updatedAt',
            'deletedAt',
            'expiresAt',
            'startDate',
            'endDate',
            'discountStart',
            'discountEnd',
            'preOrderReleaseDate',
            'expectedFulfillmentDate',
          ];
          if (dateColumns.includes(key)) {
            if (typeof newRow[key] === 'number') {
              newRow[key] = new Date(newRow[key]);
            }
          }
        }
        return newRow;
      });

      // Dynamic Drizzle Insert
      // Filter schema values to find the table object
      const schemaTable = Object.values(schema).find((t: any) => {
        try {
          // Check if it looks like a table (has name property or we can getTableName)
          // But getTableName might throw if not a table.
          // Safer: Check if it is instance of PgTable
          // But instance check might be hard if imports differ.
          // Just use try-catch on getTableName
          return getTableName(t) === tableName;
        } catch (e) {
          return false;
        }
      }) as PgTable<any>; // Cast to PgTable

      if (schemaTable) {
        try {
          await dbPg
            .insert(schemaTable)
            .values(formattedBatch)
            .onConflictDoNothing();
        } catch (e) {
          console.error(
            `   ❌ Failed to insert batch into ${tableName}: ${e.message}`,
          );
        }
      } else {
        console.error(`   ❌ Could not find Drizzle schema for ${tableName}`);
      }
    }
    console.log(`   ✅ Migrated ${rows.length} rows.`);
  }

  console.log('\n🎉 Migration Complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
