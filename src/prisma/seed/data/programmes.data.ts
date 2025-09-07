import { ProductType, PricingModel, AccessItem } from '@prisma/client';

export const programmesSeedData = [
  {
    product: {
      type: ProductType.PROGRAMME,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    programme: {
      title: 'Mindful Living Masterclass',
      description:
        'Learn the fundamentals of mindful living through practical exercises and guided meditations.',
      muxAssetId: 'sample-asset-id-1',
      muxPlaybackId: 'sample-playback-id-1',
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://via.placeholder.com/800x600/mindful-living',
      requiresAccess: AccessItem.PROGRAMME_ACCESS,
      duration: 3600, // 1 hour
      tags: ['mindfulness', 'meditation', 'lifestyle', 'wellness'],
    },
  },
  {
    product: {
      type: ProductType.PROGRAMME,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    programme: {
      title: 'Stress Management Workshop',
      description:
        'Comprehensive workshop on managing stress through various techniques and strategies.',
      muxAssetId: 'sample-asset-id-2',
      muxPlaybackId: 'sample-playback-id-2',
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://via.placeholder.com/800x600/stress-management',
      requiresAccess: AccessItem.PROGRAMME_ACCESS,
      duration: 2700, // 45 minutes
      tags: ['stress', 'management', 'health', 'wellness'],
    },
  },
  {
    product: {
      type: ProductType.PROGRAMME,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    programme: {
      title: 'Advanced Meditation Techniques',
      description:
        'Deep dive into advanced meditation practices for experienced practitioners.',
      muxAssetId: 'sample-asset-id-3',
      muxPlaybackId: 'sample-playback-id-3',
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://via.placeholder.com/800x600/advanced-meditation',
      requiresAccess: AccessItem.ALL_ACCESS,
      duration: 4200, // 70 minutes
      tags: ['meditation', 'advanced', 'spiritual', 'practice'],
    },
  },
];
