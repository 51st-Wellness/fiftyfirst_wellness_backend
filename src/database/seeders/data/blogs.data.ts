import { createId } from '@paralleldrive/cuid2';

// Create blog entries
export const blogEntries = [
  {
    id: createId(),
    title: '10 Simple Ways to Start Your Wellness Journey',
    contentKey: 'blogs/wellness-journey-start.md',
    isFeatured: true,
    isPublished: true,
    tags: ['wellness', 'beginner', 'lifestyle', 'tips'],
  },
  {
    id: createId(),
    title: 'The Science Behind Mindful Eating',
    contentKey: 'blogs/mindful-eating-science.md',
    isFeatured: false,
    isPublished: true,
    tags: ['nutrition', 'mindfulness', 'science', 'eating'],
  },
  {
    id: createId(),
    title: 'Creating a Sustainable Exercise Routine',
    contentKey: 'blogs/sustainable-exercise-routine.md',
    isFeatured: true,
    isPublished: true,
    tags: ['fitness', 'exercise', 'sustainability', 'routine'],
  },
  {
    id: createId(),
    title: 'Understanding Sleep Cycles and Quality Rest',
    contentKey: 'blogs/sleep-cycles-quality-rest.md',
    isFeatured: false,
    isPublished: true,
    tags: ['sleep', 'health', 'rest', 'recovery'],
  },
  {
    id: createId(),
    title: 'The Benefits of Daily Meditation Practice',
    contentKey: 'blogs/daily-meditation-benefits.md',
    isFeatured: true,
    isPublished: true,
    tags: ['meditation', 'mindfulness', 'mental health', 'practice'],
  },
  {
    id: createId(),
    title: 'Seasonal Wellness: Adapting Your Routine',
    contentKey: 'blogs/seasonal-wellness-adaptation.md',
    isFeatured: false,
    isPublished: true,
    tags: ['seasonal', 'wellness', 'adaptation', 'routine'],
  },
  {
    id: createId(),
    title: 'Building Healthy Relationships for Better Wellness',
    contentKey: 'blogs/healthy-relationships-wellness.md',
    isFeatured: false,
    isPublished: false, // Draft
    tags: ['relationships', 'mental health', 'wellness', 'social'],
  },
];
