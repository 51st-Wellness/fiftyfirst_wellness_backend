import { UserRole } from 'src/database/schema';
import { User } from 'src/database/types';
import * as bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';

export const generateId = () => createId();
export const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};
const hashedPassword = hashPassword('password123');
export const adminUsers = [
  {
    id: generateId(),
    email: 'admin1@fiftyfirst.com',
    password: hashedPassword,
    firstName: 'John',
    lastName: 'Admin',
    phone: '+1234567890',
    role: UserRole.ADMIN,
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
    role: UserRole.ADMIN,
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
    role: UserRole.ADMIN,
    city: 'Chicago',
    address: '789 Director Blvd',
    bio: 'Content Director and wellness coach',
    isActive: true,
  },
];

// Create 3 regular users
export const regularUsers = [
  {
    id: generateId(),
    email: 'user1@example.com',
    password: hashedPassword,
    firstName: 'Emma',
    lastName: 'Johnson',
    phone: '+1234567893',
    role: UserRole.USER,
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
    role: UserRole.USER,
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
    role: UserRole.USER,
    city: 'Austin',
    address: '987 Health Hill',
    bio: 'Mindfulness coach and meditation teacher',
    isActive: true,
  },
];
