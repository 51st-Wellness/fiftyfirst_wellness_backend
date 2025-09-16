import { Database } from '../connection';
import { products, podcasts } from '../schema';
import { generateId } from '../seed';

export async function seedPodcasts(db: Database) {
  console.log('🎙️ Seeding podcasts...');

  // Create products first (required for podcasts)
  const podcastProducts = [
    {
      id: generateId(),
      type: 'PODCAST' as const,
      pricingModel: 'SUBSCRIPTION' as const,
    },
    {
      id: generateId(),
      type: 'PODCAST' as const,
      pricingModel: 'FREE' as const,
    },
    {
      id: generateId(),
      type: 'PODCAST' as const,
      pricingModel: 'SUBSCRIPTION' as const,
    },
    {
      id: generateId(),
      type: 'PODCAST' as const,
      pricingModel: 'SUBSCRIPTION' as const,
    },
    {
      id: generateId(),
      type: 'PODCAST' as const,
      pricingModel: 'FREE' as const,
    },
  ];

  // Insert products
  await db.insert(products).values(podcastProducts);
  console.log(`✅ Created ${podcastProducts.length} podcast products`);

  // Create podcasts
  const podcastItems = [
    {
      productId: podcastProducts[0].id,
      title: 'Wellness Wednesday: Stress Management',
      description:
        'Learn effective techniques for managing stress in your daily life',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://example.com/stress-management-thumb.jpg',
      requiresAccess: 'PODCAST_ACCESS' as const,
      duration: 1800, // 30 minutes
      podcastProductId: podcastProducts[0].id,
    },
    {
      productId: podcastProducts[1].id,
      title: 'Free Introduction to Mindful Living',
      description:
        'A free introduction to incorporating mindfulness into your everyday routine',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://example.com/mindful-living-thumb.jpg',
      requiresAccess: 'PODCAST_ACCESS' as const,
      duration: 1200, // 20 minutes
      podcastProductId: podcastProducts[1].id,
    },
    {
      productId: podcastProducts[2].id,
      title: 'Nutrition Myths Debunked',
      description:
        'Separating fact from fiction in the world of nutrition and wellness',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://example.com/nutrition-myths-thumb.jpg',
      requiresAccess: 'PODCAST_ACCESS' as const,
      duration: 2400, // 40 minutes
      podcastProductId: podcastProducts[2].id,
    },
    {
      productId: podcastProducts[3].id,
      title: 'Sleep Optimization Strategies',
      description:
        'Expert tips for improving sleep quality and developing healthy sleep habits',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://example.com/sleep-optimization-thumb.jpg',
      requiresAccess: 'PODCAST_ACCESS' as const,
      duration: 2100, // 35 minutes
      podcastProductId: podcastProducts[3].id,
    },
    {
      productId: podcastProducts[4].id,
      title: 'Free Sample: Morning Meditation',
      description:
        'A complimentary guided morning meditation to start your day with intention',
      muxAssetId: `mux_asset_${generateId()}`,
      muxPlaybackId: `mux_playback_${generateId()}`,
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://example.com/morning-meditation-thumb.jpg',
      requiresAccess: 'PODCAST_ACCESS' as const,
      duration: 900, // 15 minutes
      podcastProductId: podcastProducts[4].id,
    },
  ];

  // Insert podcasts
  await db.insert(podcasts).values(podcastItems);
  console.log(`✅ Created ${podcastItems.length} podcasts`);

  console.log('🎙️ Podcasts seeding completed!');
}
