import { Database } from '../connection';
import { products, storeItems } from '../schema';
import {
  storeProducts,
  storeItems as storeItemsData,
} from './data/store-items.data';

export async function seedStoreItems(db: Database) {
  console.log('🛍️ Seeding store items...');

  // Insert products
  await db.insert(products).values(storeProducts);
  console.log(`✅ Created ${storeProducts.length} store products`);

  // Insert store items
  await db.insert(storeItems).values(storeItemsData as any);
  console.log(`✅ Created ${storeItemsData.length} store items`);

  console.log('🛍️ Store items seeding completed!');
}
