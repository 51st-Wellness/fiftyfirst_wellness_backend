import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config();

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
