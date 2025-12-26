import { createClient } from '@libsql/client';
import 'dotenv/config';

async function debugOrder() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing Turso credentials');
  }

  const turso = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  const result = await turso.execute(`SELECT * FROM "Order" LIMIT 1`);
  const row = result.rows[0];

  console.log('Raw row from Turso:');
  console.log(JSON.stringify(row, null, 2));

  console.log('\n\nColumn types:');
  for (const [key, value] of Object.entries(row)) {
    console.log(`${key}: ${typeof value} = ${JSON.stringify(value)}`);
  }
}

debugOrder();
