import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../src/database/schema';
import 'dotenv/config';

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

  const turso = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  const pool = new Pool({ connectionString: postgresUrl });
  const dbPg = drizzlePg(pool, { schema });

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
      const result = await turso.execute(`SELECT * FROM "${tableName}"`);
      rows = result.rows;
      console.log(`   Found ${rows.length} rows in Turso.`);
    } catch (e: any) {
      console.log(
        `   ⚠️ Could not read from Turso table ${tableName}: ${e.message}`,
      );
      continue;
    }

    if (rows.length === 0) continue;

    const chunk = 50;
    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      const formattedBatch = batch.map((row) => {
        const newRow: any = { ...row };

        for (const key in newRow) {
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

          // Double precision (float) fields - CRITICAL: must be parsed as numbers!
          const doubleColumns = [
            'price',
            'totalAmount',
            'shippingCost',
            'amount',
            'capturedAmount',
            'authorizedAmount',
            'discountValue',
            'weight',
            'length',
            'width',
            'height',
          ];
          if (doubleColumns.includes(key)) {
            if (
              newRow[key] === '' ||
              newRow[key] === null ||
              newRow[key] === undefined
            ) {
              newRow[key] = null;
            } else {
              const parsed = parseFloat(newRow[key]);
              newRow[key] = isNaN(parsed) ? null : parsed;
            }
          }

          const intColumns = [
            'duration',
            'billingCycle',
            'stock',
            'clickDropOrderIdentifier',
            'parcelWeight',
            'quantity',
            'reviewCount',
            'rating',
          ];
          if (intColumns.includes(key)) {
            if (
              newRow[key] === '' ||
              newRow[key] === null ||
              newRow[key] === undefined
            ) {
              newRow[key] = null;
            } else {
              const parsed = parseInt(newRow[key], 10);
              newRow[key] = isNaN(parsed) ? null : parsed;
            }
          }

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
              if (newRow[key] < 100000000000) {
                newRow[key] = new Date(newRow[key] * 1000);
              } else {
                newRow[key] = new Date(newRow[key]);
              }
            } else if (typeof newRow[key] === 'string' && newRow[key] !== '') {
              newRow[key] = new Date(newRow[key]);
            } else if (newRow[key] === '' || newRow[key] === null) {
              newRow[key] = null;
            }
          }
        }
        return newRow;
      });

      const schemaTable = Object.values(schema).find((t: any) => {
        try {
          return getTableName(t) === tableName;
        } catch (e) {
          return false;
        }
      }) as PgTable<any>;

      if (schemaTable) {
        const tableDestColumns = getTableColumns(schemaTable);
        const validColumnNames = new Set(Object.keys(tableDestColumns));

        const enumFields: Record<string, string[]> = {
          User: ['role'],
          Payment: ['status', 'provider', 'currency'],
          Order: ['status', 'preOrderStatus'],
          Subscription: ['status'],
          Review: ['status'],
          Product: ['type', 'pricingModel'],
          ProductSubscriber: ['status'],
          Programme: ['requiresAccess'],
          Podcast: ['requiresAccess'],
        };

        const cleaningBatch = formattedBatch.map((row) => {
          const cleanRow: any = {};
          for (const key of Object.keys(row)) {
            if (validColumnNames.has(key)) {
              cleanRow[key] = row[key];
            }
          }

          if (enumFields[tableName]) {
            for (const field of enumFields[tableName]) {
              if (typeof cleanRow[field] === 'string') {
                cleanRow[field] = cleanRow[field].toUpperCase();
              }
            }
          }

          // Special mapping for Order table: CANCELLED is not a valid orderStatuses enum
          if (tableName === 'Order' && cleanRow['status'] === 'CANCELLED') {
            cleanRow['status'] = 'FAILED';
          }

          if (
            tableName === 'Category' &&
            typeof cleanRow['service'] === 'string'
          ) {
            cleanRow['service'] = cleanRow['service'].toLowerCase();
          }

          return cleanRow;
        });

        try {
          // Special handling for Order table - insert one at a time to debug
          if (tableName === 'Order') {
            let successCount = 0;
            for (let idx = 0; idx < cleaningBatch.length; idx++) {
              try {
                await dbPg
                  .insert(schemaTable)
                  .values([cleaningBatch[idx]])
                  .onConflictDoNothing();
                successCount++;
              } catch (rowError: any) {
                console.error(
                  `      ❌ Failed to insert Order row #${idx + 1}: ${rowError.message}`,
                );
                console.error(
                  `         Row data:`,
                  JSON.stringify(cleaningBatch[idx], null, 2),
                );
              }
            }
            console.log(
              `      Successfully inserted ${successCount}/${cleaningBatch.length} orders`,
            );
          } else {
            await dbPg
              .insert(schemaTable)
              .values(cleaningBatch)
              .onConflictDoNothing();
          }
        } catch (e: any) {
          console.error(`   ❌ Failed to insert batch into ${tableName}`);
          console.error(`      Error message: ${e.message}`);
          console.error(`      Error code: ${e.code}`);
          console.error(`      Error detail: ${e.detail || 'N/A'}`);
          console.error(`      Error hint: ${e.hint || 'N/A'}`);

          // Print first 3 rows for debugging
          const sampleCount = Math.min(3, cleaningBatch.length);
          for (let i = 0; i < sampleCount; i++) {
            console.error(
              `\n      Sample row #${i + 1}:`,
              JSON.stringify(cleaningBatch[i], null, 2),
            );
          }
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
