import { Database } from '../connection';
import { products, programmes } from '../schema';
import { programmeProducts, programmeItems } from './data/programmes.data';

export async function seedProgrammes(db: Database) {
  console.log('🎓 Seeding programmes...');

  // Insert products
  await db.insert(products).values(programmeProducts);
  console.log(`✅ Created ${programmeProducts.length} programme products`);

  // Insert programmes
  await db.insert(programmes).values(programmeItems);
  console.log(`✅ Created ${programmeItems.length} programmes`);

  console.log('🎓 Programmes seeding completed!');
}
