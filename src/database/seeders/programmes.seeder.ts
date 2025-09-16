import { Database } from '../connection';
import { products, programmes } from '../schema';
import { generateId } from '../seed';

export async function seedProgrammes(db: Database) {
  console.log('🎓 Seeding programmes...');

  // Create products first (required for programmes)
  const programmeProducts = [
    {
      id: generateId(),
      type: 'PROGRAMME' as const,
      pricingModel: 'SUBSCRIPTION' as const,
    },
    {
      id: generateId(),
      type: 'PROGRAMME' as const,
      pricingModel: 'ONE_TIME' as const,
    },
    {
      id: generateId(),
      type: 'PROGRAMME' as const,
      pricingModel: 'SUBSCRIPTION' as const,
    },
    {
      id: generateId(),
      type: 'PROGRAMME' as const,
      pricingModel: 'FREE' as const,
    },
  ];

  // Insert products
  await db.insert(products).values(programmeProducts);
  console.log(`✅ Created ${programmeProducts.length} programme products`);

  // Create programmes
  const programmeItems = [
    {
      productId: programmeProducts[0].id,
      title: 'Complete Mindfulness Course',
      description:
        'A comprehensive 8-week mindfulness course for beginners and advanced practitioners',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://example.com/mindfulness-thumb.jpg',
      requiresAccess: 'PROGRAMME_ACCESS' as const,
      duration: 3600, // 1 hour
      tags: ['mindfulness', 'meditation', 'course', 'beginner'],
    },
    {
      productId: programmeProducts[1].id,
      title: 'Advanced Yoga Flow',
      description: 'Challenging yoga sequences for experienced practitioners',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://example.com/yoga-thumb.jpg',
      requiresAccess: 'PROGRAMME_ACCESS' as const,
      duration: 2700, // 45 minutes
      tags: ['yoga', 'advanced', 'flow', 'fitness'],
    },
    {
      productId: programmeProducts[2].id,
      title: 'Nutrition Fundamentals',
      description: 'Learn the basics of healthy nutrition and meal planning',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://example.com/nutrition-thumb.jpg',
      requiresAccess: 'PROGRAMME_ACCESS' as const,
      duration: 4200, // 70 minutes
      tags: ['nutrition', 'health', 'meal planning', 'fundamentals'],
    },
    {
      productId: programmeProducts[3].id,
      title: 'Introduction to Wellness',
      description:
        'Free introductory course to wellness principles and practices',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://example.com/intro-wellness-thumb.jpg',
      requiresAccess: 'ALL_ACCESS' as const,
      duration: 1800, // 30 minutes
      tags: ['wellness', 'introduction', 'free', 'basics'],
    },
  ];

  // Insert programmes
  await db.insert(programmes).values(programmeItems);
  console.log(`✅ Created ${programmeItems.length} programmes`);

  console.log('🎓 Programmes seeding completed!');
}
