import { Database } from '../connection';
import { settings } from '../schema';
import { ConfigService } from 'src/config/config.service';
import { createShippingSettingsData } from './data/shipping-settings.data';
import {
  GLOBAL_DISCOUNT_KEY,
  SHIPPING_RATES_KEY,
} from 'src/modules/settings/settings.constant';

export async function seedSettings(db: Database) {
  console.log('⚙️ Seeding settings...');

  // Seed Global Discount Settings
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

  // Seed Shipping Settings

  await db
    .insert(settings)
    .values({
      key: SHIPPING_RATES_KEY,
      value: JSON.stringify(createShippingSettingsData()),
      description:
        'Royal Mail Click & Drop shipping service rates and configuration',
      category: 'shipping',
      isEditable: true,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify(createShippingSettingsData()),
        description:
          'Royal Mail Click & Drop shipping service rates and configuration',
        updatedAt: new Date(),
      },
    });

  console.log('✅ Settings seeded (Global Discount + Shipping Rates)');
}
