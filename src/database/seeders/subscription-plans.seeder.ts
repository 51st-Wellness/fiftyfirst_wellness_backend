import { Database } from '../connection';
import { subscriptionPlans, subscriptionAccess } from '../schema';
import { generateId } from '../seed';

export async function seedSubscriptionPlans(db: Database) {
  console.log('💳 Seeding subscription plans...');

  // Create subscription plans
  const plans = [
    {
      id: generateId(),
      name: 'Basic Wellness',
      description: 'Access to basic wellness content and podcasts',
      price: 9.99,
      duration: 30, // 30 days
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Premium Wellness',
      description: 'Full access to all programmes and premium content',
      price: 19.99,
      duration: 30, // 30 days
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Annual Wellness',
      description: 'Complete wellness package with all access for a full year',
      price: 199.99,
      duration: 365, // 365 days
      isActive: true,
    },
    {
      id: generateId(),
      name: 'Coach Program',
      description: 'Exclusive coaching program with personalized guidance',
      price: 49.99,
      duration: 30, // 30 days
      isActive: true,
    },
  ];

  // Insert subscription plans
  await db.insert(subscriptionPlans).values(plans);
  console.log(`✅ Created ${plans.length} subscription plans`);

  // Create subscription access mappings
  const accessMappings = [
    // Basic Wellness - Podcast access only
    {
      id: generateId(),
      planId: plans[0].id,
      accessItem: 'PODCAST_ACCESS' as const,
    },

    // Premium Wellness - Programme access
    {
      id: generateId(),
      planId: plans[1].id,
      accessItem: 'PROGRAMME_ACCESS' as const,
    },
    {
      id: generateId(),
      planId: plans[1].id,
      accessItem: 'PODCAST_ACCESS' as const,
    },

    // Annual Wellness - All access
    {
      id: generateId(),
      planId: plans[2].id,
      accessItem: 'ALL_ACCESS' as const,
    },

    // Coach Program - All access
    {
      id: generateId(),
      planId: plans[3].id,
      accessItem: 'ALL_ACCESS' as const,
    },
  ];

  // Insert subscription access mappings
  await db.insert(subscriptionAccess).values(accessMappings);
  console.log(
    `✅ Created ${accessMappings.length} subscription access mappings`,
  );

  console.log('💳 Subscription plans seeding completed!');
}
