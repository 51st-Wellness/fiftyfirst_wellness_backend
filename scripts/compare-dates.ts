import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import 'dotenv/config';

async function compareDates() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get a sample user from Turso
    const tursoResult = await turso.execute(
      `SELECT id, email, createdAt, updatedAt FROM "User" LIMIT 3`,
    );
    console.log('Turso Users:');
    tursoResult.rows.forEach((user) => {
      console.log(`\n${user.email}:`);
      console.log(
        `  createdAt: ${user.createdAt} (type: ${typeof user.createdAt})`,
      );
      console.log(
        `  updatedAt: ${user.updatedAt} (type: ${typeof user.updatedAt})`,
      );

      // Convert if number
      if (typeof user.createdAt === 'number') {
        const asDate = new Date(
          user.createdAt < 100000000000
            ? user.createdAt * 1000
            : user.createdAt,
        );
        console.log(`  createdAt as Date: ${asDate.toISOString()}`);
      }
      if (typeof user.updatedAt === 'number') {
        const asDate = new Date(
          user.updatedAt < 100000000000
            ? user.updatedAt * 1000
            : user.updatedAt,
        );
        console.log(`  updatedAt as Date: ${asDate.toISOString()}`);
      }
    });

    // Get the same users from PostgreSQL
    const userIds = tursoResult.rows.map((r) => r.id);
    const pgResult = await pool.query(
      `SELECT id, email, "createdAt", "updatedAt" FROM "User" WHERE id = ANY($1::text[])`,
      [userIds],
    );

    console.log('\n\nPostgreSQL Users:');
    pgResult.rows.forEach((user) => {
      console.log(`\n${user.email}:`);
      console.log(`  createdAt: ${user.createdAt}`);
      console.log(`  updatedAt: ${user.updatedAt}`);
    });
  } finally {
    await pool.end();
  }
}

compareDates();
