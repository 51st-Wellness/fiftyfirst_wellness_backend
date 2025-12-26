import { Pool } from 'pg';
import 'dotenv/config';

async function listOrderIds() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      'SELECT id, status, "clickDropOrderIdentifier" FROM "Order" ORDER BY "createdAt"',
    );
    console.log(`Total Orders in PostgreSQL: ${result.rows.length}`);
    console.log('\nOrder IDs:');
    result.rows.forEach((row, idx) => {
      console.log(
        `${idx + 1}. ${row.id} - ${row.status} - clickDrop: ${row.clickDropOrderIdentifier}`,
      );
    });
  } finally {
    await pool.end();
  }
}

listOrderIds();
