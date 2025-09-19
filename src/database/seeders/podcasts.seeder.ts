import { Database } from '../connection';
import { products, podcasts } from '../schema';
import { podcastProducts, podcastItems } from './data/podcasts.data';

export async function seedPodcasts(db: Database) {
  console.log('🎙️ Seeding podcasts...');

  // Insert products
  await db.insert(products).values(podcastProducts);
  console.log(`✅ Created ${podcastProducts.length} podcast products`);

  // Insert podcasts
  await db.insert(podcasts).values(podcastItems);
  console.log(`✅ Created ${podcastItems.length} podcasts`);

  console.log('🎙️ Podcasts seeding completed!');
}
