import { createId } from '@paralleldrive/cuid2';

// Create subscription plans
export const plans = [
  {
    id: createId(),
    name: 'Basic Wellness',
    description: 'Access to basic wellness content and podcasts',
    price: 9.99,
    duration: 30, // 30 days
    isActive: true,
  },
  {
    id: createId(),
    name: 'Premium Wellness',
    description: 'Full access to all programmes and premium content',
    price: 19.99,
    duration: 30, // 30 days
    isActive: true,
  },
  {
    id: createId(),
    name: 'Annual Wellness',
    description: 'Complete wellness package with all access for a full year',
    price: 199.99,
    duration: 365, // 365 days
    isActive: true,
  },
  {
    id: createId(),
    name: 'Coach Program',
    description: 'Exclusive coaching program with personalized guidance',
    price: 49.99,
    duration: 30, // 30 days
    isActive: true,
  },
];

// Create subscription access mappings
export const accessMappings = [
  // Basic Wellness - Podcast access only
  {
    id: createId(),
    planId: plans[0].id,
    accessItem: 'PODCAST_ACCESS' as const,
  },

  // Premium Wellness - Programme access
  {
    id: createId(),
    planId: plans[1].id,
    accessItem: 'PROGRAMME_ACCESS' as const,
  },
  {
    id: createId(),
    planId: plans[1].id,
    accessItem: 'PODCAST_ACCESS' as const,
  },

  // Annual Wellness - All access
  {
    id: createId(),
    planId: plans[2].id,
    accessItem: 'ALL_ACCESS' as const,
  },

  // Coach Program - All access
  {
    id: createId(),
    planId: plans[3].id,
    accessItem: 'ALL_ACCESS' as const,
  },
];
