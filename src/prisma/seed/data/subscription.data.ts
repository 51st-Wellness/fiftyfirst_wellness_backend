import { AccessItem } from '@prisma/client';

export const subscriptionPlansSeedData = [
  {
    name: 'Basic Plan',
    description: 'Access to podcast content only',
    price: 9.99,
    duration: 30, // 30 days
    isActive: true,
    subscriptionAccess: [
      {
        accessItem: AccessItem.PODCAST_ACCESS,
      },
    ],
  },
  {
    name: 'Premium Plan',
    description: 'Access to programmes and podcasts',
    price: 19.99,
    duration: 30, // 30 days
    isActive: true,
    subscriptionAccess: [
      {
        accessItem: AccessItem.PODCAST_ACCESS,
      },
      {
        accessItem: AccessItem.PROGRAMME_ACCESS,
      },
    ],
  },
  {
    name: 'All Access Plan',
    description: 'Full access to all content and features',
    price: 29.99,
    duration: 30, // 30 days
    isActive: true,
    subscriptionAccess: [
      {
        accessItem: AccessItem.ALL_ACCESS,
      },
    ],
  },
  {
    name: 'Annual Premium',
    description: 'Annual access to programmes and podcasts - Save 20%',
    price: 199.99,
    duration: 365, // 365 days
    isActive: true,
    subscriptionAccess: [
      {
        accessItem: AccessItem.PODCAST_ACCESS,
      },
      {
        accessItem: AccessItem.PROGRAMME_ACCESS,
      },
    ],
  },
];
