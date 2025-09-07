import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const adminSeedData = {
  email: 'admin@fiftyfirst.com',
  password: bcrypt.hashSync('admin123!', 10),
  firstName: 'System',
  lastName: 'Admin',
  phone: '+1234567890',
  role: UserRole.ADMIN,
  city: 'New York',
  address: '123 Admin Street, NY 10001',
  bio: 'System administrator for Fifty First Wellness platform',
  profilePicture: 'https://via.placeholder.com/150/admin',
  isActive: true,
};
