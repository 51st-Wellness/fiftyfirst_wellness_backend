import { Bookmark, Product, User } from '@prisma/client';

export interface BookmarkWithRelations extends Bookmark {
  product: Product & {
    storeItem?: any;
    programme?: any;
    podcast?: any;
  };
  user: Omit<User, 'password'>;
}
