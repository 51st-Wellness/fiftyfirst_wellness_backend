import { createId } from '@paralleldrive/cuid2';

const now = new Date();
const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

// Create products first (required for store items)
export const storeProducts = [
  {
    id: createId(),
    type: 'STORE' as const,
    pricingModel: 'ONE_TIME' as const,
  },
  {
    id: createId(),
    type: 'STORE' as const,
    pricingModel: 'ONE_TIME' as const,
  },
  {
    id: createId(),
    type: 'STORE' as const,
    pricingModel: 'ONE_TIME' as const,
  },
  {
    id: createId(),
    type: 'STORE' as const,
    pricingModel: 'ONE_TIME' as const,
  },
  {
    id: createId(),
    type: 'STORE' as const,
    pricingModel: 'ONE_TIME' as const,
  },
];

// Create store items
export const storeItems = [
  {
    productId: storeProducts[0].id,
    name: 'Wellness Essential Oil Set',
    description:
      'Premium collection of essential oils for aromatherapy and relaxation',
    price: 49.99,
    stock: 50,
    display: { url: 'https://example.com/essential-oils.jpg', type: 'image' },
    images: ['https://example.com/oil1.jpg', 'https://example.com/oil2.jpg'],
    categories: ['Aromatherapy', 'Relaxation'],
    isFeatured: true,
    isPublished: true,
    discountType: 'PERCENTAGE',
    discountValue: 15,
    discountActive: true,
    discountStart: now,
    discountEnd: nextMonth,
  },
  {
    productId: storeProducts[1].id,
    name: 'Meditation Cushion Set',
    description:
      'Comfortable meditation cushions for your mindfulness practice',
    price: 79.99,
    stock: 25,
    display: {
      url: 'https://example.com/meditation-cushion.jpg',
      type: 'image',
    },
    images: [
      'https://example.com/cushion1.jpg',
      'https://example.com/cushion2.jpg',
    ],
    categories: ['Meditation', 'Comfort'],
    isFeatured: false,
    isPublished: true,
    discountType: 'NONE',
    discountValue: 0,
    discountActive: false,
  },
  {
    productId: storeProducts[2].id,
    name: 'Wellness Journal',
    description:
      'Beautiful journal for tracking your wellness journey and daily reflections',
    price: 24.99,
    stock: 100,
    display: {
      url: 'https://example.com/wellness-journal.jpg',
      type: 'image',
    },
    images: [
      'https://example.com/journal1.jpg',
      'https://example.com/journal2.jpg',
    ],
    categories: ['Mindfulness', 'Journaling'],
    isFeatured: true,
    isPublished: true,
    discountType: 'FLAT',
    discountValue: 5,
    discountActive: true,
    discountStart: now,
  },
  {
    productId: storeProducts[3].id,
    name: 'Yoga Mat Premium',
    description:
      'High-quality non-slip yoga mat perfect for all types of yoga practice',
    price: 59.99,
    stock: 35,
    display: { url: 'https://example.com/yoga-mat.jpg', type: 'image' },
    images: ['https://example.com/mat1.jpg', 'https://example.com/mat2.jpg'],
    categories: ['Yoga', 'Fitness'],
    isFeatured: false,
    isPublished: true,
    discountType: 'PERCENTAGE',
    discountValue: 10,
    discountActive: true,
  },
  {
    productId: storeProducts[4].id,
    name: 'Herbal Tea Collection',
    description: 'Organic herbal teas for relaxation and wellness support',
    price: 34.99,
    stock: 75,
    display: { url: 'https://example.com/herbal-tea.jpg', type: 'image' },
    images: ['https://example.com/tea1.jpg', 'https://example.com/tea2.jpg'],
    categories: ['Tea', 'Relaxation'],
    isFeatured: true,
    isPublished: true,
    discountType: 'NONE',
    discountValue: 0,
    discountActive: false,
  },
];
