export const databaseConfig = () => ({
  database: {
    url: process.env.DATABASE_URL,
    tursoUrl: process.env.DATABASE_URL,
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN,
  },
});
