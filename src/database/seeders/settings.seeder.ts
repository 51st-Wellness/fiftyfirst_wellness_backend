import { Database } from '../connection';
import { settings } from '../schema';

const GLOBAL_DISCOUNT_KEY = 'STORE_GLOBAL_DISCOUNT';

export async function seedSettings(db: Database) {
  console.log('⚙️ Seeding settings...');

  await db
    .insert(settings)
    .values({
      key: GLOBAL_DISCOUNT_KEY,
      value: JSON.stringify({
        isActive: false,
        type: 'NONE',
        value: 0,
        minOrderTotal: 0,
        label: 'Storewide discount',
      }),
      description:
        'Global discount applied to store checkouts that meet the minimum total.',
      category: 'commerce',
      isEditable: true,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify({
          isActive: false,
          type: 'NONE',
          value: 0,
          minOrderTotal: 0,
          label: 'Storewide discount',
        }),
        description:
          'Global discount applied to store checkouts that meet the minimum total.',
        updatedAt: new Date(),
      },
    });

  console.log('✅ Settings seeded');
}
