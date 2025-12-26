import { Pool } from 'pg';
import 'dotenv/config';

async function checkOrders() {
  const postgresUrl = process.env.DATABASE_URL;
  if (!postgresUrl) {
    throw new Error('Missing DATABASE_URL');
  }

  const pool = new Pool({ connectionString: postgresUrl });

  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM "Order"');
    console.log(`Total Orders in PostgreSQL: ${result.rows[0].count}`);

    const sampleResult = await pool.query(
      'SELECT id, status, "totalAmount", "createdAt" FROM "Order" LIMIT 5',
    );
    console.log('\nSample Orders:');
    console.log(JSON.stringify(sampleResult.rows, null, 2));
  } finally {
    await pool.end();
  }
}

checkOrders();
