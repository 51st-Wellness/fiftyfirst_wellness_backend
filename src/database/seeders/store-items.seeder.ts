import { Database } from '../connection';
import { products, storeItems } from '../schema';
import { generateId } from '../seed';

export async function seedStoreItems(db: Database) {
  console.log('🛍️ Seeding store items...');

  // Create products first (required for store items)
  const storeProducts = [
    {
      id: generateId(),
      type: 'STORE' as const,
      pricingModel: 'ONE_TIME' as const,
    },
    {
      id: generateId(),
      type: 'STORE' as const,
      pricingModel: 'ONE_TIME' as const,
    },
    {
      id: generateId(),
      type: 'STORE' as const,
      pricingModel: 'ONE_TIME' as const,
    },
    {
      id: generateId(),
      type: 'STORE' as const,
      pricingModel: 'ONE_TIME' as const,
    },
    {
      id: generateId(),
      type: 'STORE' as const,
      pricingModel: 'ONE_TIME' as const,
    },
  ];

  // Insert products
  await db.insert(products).values(storeProducts);
  console.log(`✅ Created ${storeProducts.length} store products`);

  // Create store items
  const items = [
    {
      productId: storeProducts[0].id,
      name: 'Wellness Essential Oil Set',
      description:
        'Premium collection of essential oils for aromatherapy and relaxation',
      price: 49.99,
      stock: 50,
      display: { url: 'https://example.com/essential-oils.jpg', type: 'image' },
      images: ['https://example.com/oil1.jpg', 'https://example.com/oil2.jpg'],
      tags: ['essential oils', 'aromatherapy', 'wellness', 'relaxation'],
      isFeatured: true,
      isPublished: true,
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
      tags: ['meditation', 'mindfulness', 'cushion', 'comfort'],
      isFeatured: false,
      isPublished: true,
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
      tags: ['journal', 'wellness', 'tracking', 'mindfulness'],
      isFeatured: true,
      isPublished: true,
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
      tags: ['yoga', 'fitness', 'exercise', 'mat'],
      isFeatured: false,
      isPublished: true,
    },
    {
      productId: storeProducts[4].id,
      name: 'Herbal Tea Collection',
      description: 'Organic herbal teas for relaxation and wellness support',
      price: 34.99,
      stock: 75,
      display: { url: 'https://example.com/herbal-tea.jpg', type: 'image' },
      images: ['https://example.com/tea1.jpg', 'https://example.com/tea2.jpg'],
      tags: ['herbal tea', 'organic', 'wellness', 'relaxation'],
      isFeatured: true,
      isPublished: true,
    },
  ];

  // Insert store items
  await db.insert(storeItems).values(items);
  console.log(`✅ Created ${items.length} store items`);

  console.log('🛍️ Store items seeding completed!');
}
