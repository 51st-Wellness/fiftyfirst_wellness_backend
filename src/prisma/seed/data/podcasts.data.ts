import { ProductType, PricingModel, AccessItem } from '@prisma/client';

export const podcastsSeedData = [
  {
    product: {
      type: ProductType.PODCAST,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    podcast: {
      title: 'Daily Wellness Check-in',
      description:
        'Start your day with intention and mindfulness through this daily wellness podcast.',
      muxAssetId: 'podcast-asset-id-1',
      muxPlaybackId: 'podcast-playback-id-1',
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://via.placeholder.com/800x600/daily-wellness',
      requiresAccess: AccessItem.PODCAST_ACCESS,
      duration: 900, // 15 minutes
      podcastProductId: 'daily-wellness-series',
    },
  },
  {
    product: {
      type: ProductType.PODCAST,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    podcast: {
      title: 'Mindfulness Moments',
      description: 'Quick mindfulness exercises you can do anywhere, anytime.',
      muxAssetId: 'podcast-asset-id-2',
      muxPlaybackId: 'podcast-playback-id-2',
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://via.placeholder.com/800x600/mindfulness-moments',
      requiresAccess: AccessItem.PODCAST_ACCESS,
      duration: 600, // 10 minutes
      podcastProductId: 'mindfulness-series',
    },
  },
  {
    product: {
      type: ProductType.PODCAST,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    podcast: {
      title: 'Sleep Stories for Adults',
      description:
        'Calming bedtime stories designed to help you unwind and drift off to sleep.',
      muxAssetId: 'podcast-asset-id-3',
      muxPlaybackId: 'podcast-playback-id-3',
      isPublished: true,
      isFeatured: true,
      thumbnail: 'https://via.placeholder.com/800x600/sleep-stories',
      requiresAccess: AccessItem.PODCAST_ACCESS,
      duration: 1800, // 30 minutes
      podcastProductId: 'sleep-series',
    },
  },
  {
    product: {
      type: ProductType.PODCAST,
      pricingModel: PricingModel.SUBSCRIPTION,
    },
    podcast: {
      title: 'Wellness Expert Interviews',
      description:
        'In-depth conversations with leading wellness experts and practitioners.',
      muxAssetId: 'podcast-asset-id-4',
      muxPlaybackId: 'podcast-playback-id-4',
      isPublished: true,
      isFeatured: false,
      thumbnail: 'https://via.placeholder.com/800x600/expert-interviews',
      requiresAccess: AccessItem.PODCAST_ACCESS,
      duration: 2400, // 40 minutes
      podcastProductId: 'expert-interview-series',
    },
  },
];
