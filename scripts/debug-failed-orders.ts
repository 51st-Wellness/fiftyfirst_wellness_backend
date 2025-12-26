import { createClient } from '@libsql/client';
import 'dotenv/config';

async function debugFailedOrders() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing Turso credentials');
  }

  const turso = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  // Get the specific order IDs that are failing (row #1, #2, #17 based on previous output)
  const result = await turso.execute(`SELECT * FROM "Order" LIMIT 23`);
  const rows = result.rows;

  const failedIds = [
    rows[0]?.id || ' unknown', // Row 1
    rows[1]?.id || 'unknown', // Row 2
    rows[16]?.id || 'unknown', // Row 17
  ];

  console.log('Checking failed order IDs:', failedIds);

  for (const id of failedIds) {
    if (id === 'unknown') continue;
    const orderResult = await turso.execute(
      `SELECT * FROM "Order" WHERE id = ?`,
      [id],
    );
    const order = orderResult.rows[0];

    console.log(`\n===== Order ${id} =====`);
    console.log('previewImage exists:', !!order.previewImage);
    console.log('previewImage length:', order.previewImage?.length || 0);

    if (order.statusHistory) {
      console.log('statusHistory type:', typeof order.statusHistory);
      console.log('statusHistory:', order.statusHistory);
    }
  }
}

debugFailedOrders();
