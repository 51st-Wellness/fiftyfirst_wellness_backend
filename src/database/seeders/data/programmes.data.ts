import { createId } from '@paralleldrive/cuid2';

// Create products first (required for programmes)
export const programmeProducts = [
  {
    id: createId(),
    type: 'PROGRAMME' as const,
    pricingModel: 'SUBSCRIPTION' as const,
  },
  {
    id: createId(),
    type: 'PROGRAMME' as const,
    pricingModel: 'ONE_TIME' as const,
  },
  {
    id: createId(),
    type: 'PROGRAMME' as const,
    pricingModel: 'SUBSCRIPTION' as const,
  },
  {
    id: createId(),
    type: 'PROGRAMME' as const,
    pricingModel: 'FREE' as const,
  },
];

// Create programmes
export const programmeItems = [
  {
    productId: programmeProducts[0].id,
    title: 'Complete Mindfulness Course',
    description:
      'A comprehensive 8-week mindfulness course for beginners and advanced practitioners',
    muxAssetId: `mux_asset_${createId()}`,
    muxPlaybackId: `mux_playback_${createId()}`,
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
    muxAssetId: `mux_asset_${createId()}`,
    muxPlaybackId: `mux_playback_${createId()}`,
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
    muxAssetId: `mux_asset_${createId()}`,
    muxPlaybackId: `mux_playback_${createId()}`,
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
    muxAssetId: `mux_asset_${createId()}`,
    muxPlaybackId: `mux_playback_${createId()}`,
    isPublished: true,
    isFeatured: false,
    thumbnail: 'https://example.com/intro-wellness-thumb.jpg',
    requiresAccess: 'ALL_ACCESS' as const,
    duration: 1800, // 30 minutes
    tags: ['wellness', 'introduction', 'free', 'basics'],
  },
];
