import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

import * as schema from './schema';
import * as bcrypt from 'bcrypt';
import { Database } from './connection';
import { config } from 'dotenv';

// Load environment variables
config();

// Entity seeders
import { seedUsers } from 'src/database/seeders/users.seeder';
import { seedSubscriptionPlans } from 'src/database/seeders/subscription-plans.seeder';
import { seedCategories } from 'src/database/seeders/categories.seeder';
import { seedStoreItems } from 'src/database/seeders/store-items.seeder';
import { seedProgrammes } from 'src/database/seeders/programmes.seeder';
import { seedPodcasts } from 'src/database/seeders/podcasts.seeder';
import { seedBlogs } from 'src/database/seeders/blogs.seeder';

// Available seeders map
const SEEDERS = {
  users: seedUsers,
  'subscription-plans': seedSubscriptionPlans,
  categories: seedCategories,
  'store-items': seedStoreItems,
  programmes: seedProgrammes,
  podcasts: seedPodcasts,
  blogs: seedBlogs,
  all: async (db: Database) => {
    console.log('🌱 Seeding all entities...');
    await seedUsers(db);
    await seedSubscriptionPlans(db);
    await seedCategories(db);
    await seedStoreItems(db);
    await seedProgrammes(db);
    await seedPodcasts(db);
    await seedBlogs(db);
    console.log('✅ All entities seeded successfully!');
  },
} as const;

type SeederName = keyof typeof SEEDERS;

async function createDbConnection(): Promise<Database> {
  const url = process.env.DATABASE_URL || 'file:./database/dev.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

async function main() {
  const entityName = process.argv[2] as SeederName;

  if (!entityName) {
    console.error('❌ Please provide an entity name to seed.');
    console.log('Available entities:', Object.keys(SEEDERS).join(', '));
    process.exit(1);
  }

  if (!SEEDERS[entityName]) {
    console.error(`❌ Unknown entity: ${entityName}`);
    console.log('Available entities:', Object.keys(SEEDERS).join(', '));
    process.exit(1);
  }

  try {
    console.log(`🌱 Starting to seed: ${entityName}`);

    const db = await createDbConnection();
    await SEEDERS[entityName](db);

    console.log(`✅ Successfully seeded: ${entityName}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
