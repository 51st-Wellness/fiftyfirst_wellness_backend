import { Database } from '../connection';
import { categories } from '../schema';
import { generateId } from '../utils';

export async function seedCategories(db: Database) {
  console.log('🌱 Seeding categories...');

  // Sample categories for each service
  const sampleCategories = [
    // Store categories
    {
      name: 'Wellness Products',
      description: 'Health and wellness related products',
      service: 'store' as const,
    },
    {
      name: 'Supplements',
      description: 'Vitamins and nutritional supplements',
      service: 'store' as const,
    },
    {
      name: 'Fitness Equipment',
      description: 'Equipment for physical fitness and exercise',
      service: 'store' as const,
    },
    {
      name: 'Meditation Tools',
      description: 'Tools and accessories for meditation practice',
      service: 'store' as const,
    },
    {
      name: 'Self-Care',
      description: 'Products for personal care and relaxation',
      service: 'store' as const,
    },

    // Programme categories
    {
      name: 'Stress Management',
      description: 'Programs focused on reducing and managing stress',
      service: 'programme' as const,
    },
    {
      name: 'Mindfulness',
      description: 'Mindfulness and awareness training programs',
      service: 'programme' as const,
    },
    {
      name: 'Physical Wellness',
      description: 'Programs focused on physical health and fitness',
      service: 'programme' as const,
    },
    {
      name: 'Mental Health',
      description: 'Programs supporting mental health and wellbeing',
      service: 'programme' as const,
    },
    {
      name: 'Work-Life Balance',
      description: 'Programs for achieving better work-life balance',
      service: 'programme' as const,
    },
    {
      name: 'Leadership',
      description: 'Leadership development and skills programs',
      service: 'programme' as const,
    },

    // Podcast categories
    {
      name: 'Wellness Talks',
      description: 'Conversations about wellness and health topics',
      service: 'podcast' as const,
    },
    {
      name: 'Expert Interviews',
      description: 'Interviews with wellness and business experts',
      service: 'podcast' as const,
    },
    {
      name: 'Mindfulness Sessions',
      description: 'Guided mindfulness and meditation sessions',
      service: 'podcast' as const,
    },
    {
      name: 'Success Stories',
      description: 'Stories of personal and professional success',
      service: 'podcast' as const,
    },
    {
      name: 'Industry Insights',
      description: 'Insights and trends in the wellness industry',
      service: 'podcast' as const,
    },
  ];

  // Check if categories already exist
  const existingCategories = await db.select().from(categories).limit(1);

  if (existingCategories.length > 0) {
    console.log('✅ Categories already exist, skipping seeding');
    return;
  }

  // Insert sample categories
  const categoriesToInsert = sampleCategories.map((cat) => ({
    id: generateId(),
    ...cat,
  }));

  await db.insert(categories).values(categoriesToInsert);

  console.log(`✅ Successfully seeded ${categoriesToInsert.length} categories`);
  console.log(
    '   📦 Store categories:',
    categoriesToInsert.filter((c) => c.service === 'store').length,
  );
  console.log(
    '   🎯 Programme categories:',
    categoriesToInsert.filter((c) => c.service === 'programme').length,
  );
  console.log(
    '   🎙️ Podcast categories:',
    categoriesToInsert.filter((c) => c.service === 'podcast').length,
  );
}
