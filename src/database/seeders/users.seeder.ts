import { Database } from '../connection';
import { users } from '../schema';
import { User } from '../types';
import { adminUsers, regularUsers } from './data/users.data';
export async function seedUsers(db: Database) {
  console.log('👤 Seeding users...');

  // Insert admin users
  await db.insert(users).values(adminUsers);
  console.log(`✅ Created ${adminUsers.length} admin users`);

  // Insert regular users
  await db.insert(users).values(regularUsers);
  console.log(`✅ Created ${regularUsers.length} regular users`);

  console.log('👤 Users seeding completed!');
}
