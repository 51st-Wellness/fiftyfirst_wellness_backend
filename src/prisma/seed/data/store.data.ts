import { ProductType, PricingModel } from '@prisma/client';

export const storeItemsSeedData = [
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Wellness Essential Kit',
      description:
        'Complete wellness starter kit including meditation cushion, aromatherapy oils, and wellness journal.',
      price: 89.99,
      stock: 25,
      display: {
        url: 'https://via.placeholder.com/800x600/wellness-kit',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/wellness-kit-1',
        'https://via.placeholder.com/400x300/wellness-kit-2',
        'https://via.placeholder.com/400x300/wellness-kit-3',
      ],
      tags: ['wellness', 'meditation', 'aromatherapy', 'starter-kit'],
      isFeatured: true,
      isPublished: true,
    },
  },
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Organic Herbal Tea Collection',
      description:
        'Curated selection of 12 premium organic herbal teas for relaxation and wellness.',
      price: 34.99,
      stock: 50,
      display: {
        url: 'https://via.placeholder.com/800x600/tea-collection',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/tea-collection-1',
        'https://via.placeholder.com/400x300/tea-collection-2',
      ],
      tags: ['tea', 'organic', 'herbal', 'wellness', 'relaxation'],
      isFeatured: false,
      isPublished: true,
    },
  },
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Mindfulness Journal',
      description:
        'Beautiful leather-bound journal with guided prompts for daily mindfulness practice.',
      price: 24.99,
      stock: 100,
      display: {
        url: 'https://via.placeholder.com/800x600/mindfulness-journal',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/journal-1',
        'https://via.placeholder.com/400x300/journal-2',
        'https://via.placeholder.com/400x300/journal-3',
      ],
      tags: ['journal', 'mindfulness', 'meditation', 'writing', 'self-care'],
      isFeatured: true,
      isPublished: true,
    },
  },
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Yoga Mat Premium',
      description:
        'High-quality eco-friendly yoga mat with superior grip and cushioning.',
      price: 69.99,
      stock: 30,
      display: {
        url: 'https://via.placeholder.com/800x600/yoga-mat',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/yoga-mat-1',
        'https://via.placeholder.com/400x300/yoga-mat-2',
      ],
      tags: ['yoga', 'exercise', 'eco-friendly', 'fitness', 'meditation'],
      isFeatured: false,
      isPublished: true,
    },
  },
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Aromatherapy Diffuser Set',
      description:
        'Ultrasonic essential oil diffuser with starter set of 6 therapeutic grade oils.',
      price: 45.99,
      stock: 40,
      display: {
        url: 'https://via.placeholder.com/800x600/diffuser-set',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/diffuser-1',
        'https://via.placeholder.com/400x300/diffuser-2',
        'https://via.placeholder.com/400x300/oils-set',
      ],
      tags: [
        'aromatherapy',
        'essential-oils',
        'diffuser',
        'relaxation',
        'wellness',
      ],
      isFeatured: true,
      isPublished: true,
    },
  },
  {
    product: {
      type: ProductType.STORE,
      pricingModel: PricingModel.ONE_TIME,
    },
    storeItem: {
      name: 'Meditation Cushion',
      description:
        'Traditional zabuton meditation cushion filled with buckwheat hulls for comfort.',
      price: 39.99,
      stock: 20,
      display: {
        url: 'https://via.placeholder.com/800x600/meditation-cushion',
        type: 'image',
      },
      images: [
        'https://via.placeholder.com/400x300/cushion-1',
        'https://via.placeholder.com/400x300/cushion-2',
      ],
      tags: ['meditation', 'cushion', 'traditional', 'comfort', 'mindfulness'],
      isFeatured: false,
      isPublished: true,
    },
  },
];
