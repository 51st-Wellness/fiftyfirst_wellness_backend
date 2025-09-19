import { Database } from '../connection';
import { blogs } from '../schema';
import { blogEntries } from './data/blogs.data';
export async function seedBlogs(db: Database) {
  console.log('📝 Seeding blogs...');

  await db.insert(blogs).values(blogEntries);
  console.log(`✅ Created ${blogEntries.length} blog entries`);

  console.log('📝 Blogs seeding completed!');
}
