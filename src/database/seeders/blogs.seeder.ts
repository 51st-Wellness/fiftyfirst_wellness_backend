import { Database } from '../connection';
import { blogs } from '../schema';
import { generateId } from '../seed';

export async function seedBlogs(db: Database) {
  console.log('📝 Seeding blogs...');

  // Create blog entries
  const blogEntries = [
    {
      id: generateId(),
      title: '10 Simple Ways to Start Your Wellness Journey',
      contentKey: 'blogs/wellness-journey-start.md',
      isFeatured: true,
      isPublished: true,
      tags: ['wellness', 'beginner', 'lifestyle', 'tips'],
    },
    {
      id: generateId(),
      title: 'The Science Behind Mindful Eating',
      contentKey: 'blogs/mindful-eating-science.md',
      isFeatured: false,
      isPublished: true,
      tags: ['nutrition', 'mindfulness', 'science', 'eating'],
    },
    {
      id: generateId(),
      title: 'Creating a Sustainable Exercise Routine',
      contentKey: 'blogs/sustainable-exercise-routine.md',
      isFeatured: true,
      isPublished: true,
      tags: ['fitness', 'exercise', 'sustainability', 'routine'],
    },
    {
      id: generateId(),
      title: 'Understanding Sleep Cycles and Quality Rest',
      contentKey: 'blogs/sleep-cycles-quality-rest.md',
      isFeatured: false,
      isPublished: true,
      tags: ['sleep', 'health', 'rest', 'recovery'],
    },
    {
      id: generateId(),
      title: 'The Benefits of Daily Meditation Practice',
      contentKey: 'blogs/daily-meditation-benefits.md',
      isFeatured: true,
      isPublished: true,
      tags: ['meditation', 'mindfulness', 'mental health', 'practice'],
    },
    {
      id: generateId(),
      title: 'Seasonal Wellness: Adapting Your Routine',
      contentKey: 'blogs/seasonal-wellness-adaptation.md',
      isFeatured: false,
      isPublished: true,
      tags: ['seasonal', 'wellness', 'adaptation', 'routine'],
    },
    {
      id: generateId(),
      title: 'Building Healthy Relationships for Better Wellness',
      contentKey: 'blogs/healthy-relationships-wellness.md',
      isFeatured: false,
      isPublished: false, // Draft
      tags: ['relationships', 'mental health', 'wellness', 'social'],
    },
  ];

  // Insert blog entries
  await db.insert(blogs).values(blogEntries);
  console.log(`✅ Created ${blogEntries.length} blog entries`);

  console.log('📝 Blogs seeding completed!');
}
