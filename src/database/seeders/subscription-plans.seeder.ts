import { Database } from '../connection';
import { subscriptionPlans, subscriptionAccess } from '../schema';
import { plans, accessMappings } from './data/subscription-plans.data';

export async function seedSubscriptionPlans(db: Database) {
  console.log('💳 Seeding subscription plans...');

  // Insert subscription plans
  await db.insert(subscriptionPlans).values(plans);
  console.log(`✅ Created ${plans.length} subscription plans`);

  // Insert subscription access mappings
  await db.insert(subscriptionAccess).values(accessMappings);
  console.log(
    `✅ Created ${accessMappings.length} subscription access mappings`,
  );

  console.log('💳 Subscription plans seeding completed!');
}
