import { Database } from '../connection';
import { users } from '../schema';
import { generateId, hashPassword } from '../seed';

export async function seedUsers(db: Database) {
  console.log('👤 Seeding users...');

  // Hash the default password for all users
  const hashedPassword = await hashPassword('password123');

  // Create 3 admin users
  const adminUsers = [
    {
      id: generateId(),
      email: 'admin1@fiftyfirst.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Admin',
      phone: '+1234567890',
      role: 'ADMIN' as const,
      city: 'New York',
      address: '123 Admin Street',
      bio: 'Senior Administrator with wellness expertise',
      isActive: true,
    },
    {
      id: generateId(),
      email: 'admin2@fiftyfirst.com',
      password: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Manager',
      phone: '+1234567891',
      role: 'ADMIN' as const,
      city: 'Los Angeles',
      address: '456 Manager Ave',
      bio: 'Operations Manager focused on user experience',
      isActive: true,
    },
    {
      id: generateId(),
      email: 'admin3@fiftyfirst.com',
      password: hashedPassword,
      firstName: 'Michael',
      lastName: 'Director',
      phone: '+1234567892',
      role: 'ADMIN' as const,
      city: 'Chicago',
      address: '789 Director Blvd',
      bio: 'Content Director and wellness coach',
      isActive: true,
    },
  ];

  // Create 3 regular users
  const regularUsers = [
    {
      id: generateId(),
      email: 'user1@example.com',
      password: hashedPassword,
      firstName: 'Emma',
      lastName: 'Johnson',
      phone: '+1234567893',
      role: 'USER' as const,
      city: 'San Francisco',
      address: '321 User Lane',
      bio: 'Wellness enthusiast and yoga practitioner',
      isActive: true,
    },
    {
      id: generateId(),
      email: 'user2@example.com',
      password: hashedPassword,
      firstName: 'David',
      lastName: 'Wilson',
      phone: '+1234567894',
      role: 'USER' as const,
      city: 'Seattle',
      address: '654 Wellness Way',
      bio: 'Fitness lover and nutrition advocate',
      isActive: true,
    },
    {
      id: generateId(),
      email: 'user3@example.com',
      password: hashedPassword,
      firstName: 'Lisa',
      lastName: 'Brown',
      phone: '+1234567895',
      role: 'USER' as const,
      city: 'Austin',
      address: '987 Health Hill',
      bio: 'Mindfulness coach and meditation teacher',
      isActive: true,
    },
  ];

  // Insert admin users
  await db.insert(users).values(adminUsers);
  console.log(`✅ Created ${adminUsers.length} admin users`);

  // Insert regular users
  await db.insert(users).values(regularUsers);
  console.log(`✅ Created ${regularUsers.length} regular users`);

  console.log('👤 Users seeding completed!');
}
