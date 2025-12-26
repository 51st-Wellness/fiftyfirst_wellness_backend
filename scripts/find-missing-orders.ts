import { createClient } from '@libsql/client';
import { Pool } from 'pg';
import 'dotenv/config';

async function findMissingOrders() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get all from Turso
    const tursoResult = await turso.execute(`SELECT id FROM "Order"`);
    const tursoIds = tursoResult.rows.map((r) => r.id);

    // Get all from Postgres
    const pgResult = await pool.query('SELECT id FROM "Order"');
    const pgIds = new Set(pgResult.rows.map((r) => r.id));

    // Find missing
    const missing = tursoIds.filter((id) => !pgIds.has(id));

    console.log(`Total in Turso: ${tursoIds.length}`);
    console.log(`Total in PostgreSQL: ${pgIds.size}`);
    console.log(`\nMissing ${missing.length} orders:`);

    for (const id of missing) {
      const orderResult = await turso.execute(
        `SELECT * FROM "Order" WHERE id = ?`,
        [id],
      );
      const order = orderResult.rows[0];
      console.log(`\n- ${id}:`);
      console.log(`  Status: ${order.status}`);
      console.log(`  ClickDrop: ${order.clickDropOrderIdentifier}`);
      console.log(`  PreviewImage length: ${order.previewImage?.length || 0}`);
      console.log(
        `  StatusHistory: ${typeof order.statusHistory} (${order.statusHistory?.length || 0} chars)`,
      );
    }
  } finally {
    await pool.end();
  }
}

findMissingOrders();
