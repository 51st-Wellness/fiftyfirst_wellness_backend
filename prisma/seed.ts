import { SeedService } from '../src/prisma/seed/seed.service';

async function main() {
  const seedService = new SeedService();
  await seedService.seed();
}

main()
  .then(async () => {
    console.log('🎉 Seeding process completed!');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('💥 Seeding process failed:', e);
    process.exit(1);
  });
