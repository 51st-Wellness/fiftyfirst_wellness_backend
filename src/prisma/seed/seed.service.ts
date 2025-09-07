import { PrismaClient } from '@prisma/client';
import { adminSeedData } from './data/admin.data';
import { subscriptionPlansSeedData } from './data/subscription.data';
import { storeItemsSeedData } from './data/store.data';
import { programmesSeedData } from './data/programmes.data';
import { podcastsSeedData } from './data/podcasts.data';
import { blogsSeedData } from './data/blogs.data';

export class SeedService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async seed() {
    try {
      console.log('🌱 Starting database seeding...');

      // Clear existing data (optional - comment out if you want to keep existing data)
      await this.clearDatabase();

      // Seed admin user
      // await this.seedAdmin();

      // Seed subscription plans
      await this.seedSubscriptionPlans();

      // Seed store items
      await this.seedStoreItems();

      // Seed programmes
      // await this.seedProgrammes();

      // Seed podcasts
      // await this.seedPodcasts();

      // Seed blogs
      // await this.seedBlogs();

      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error during database seeding:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async clearDatabase() {
    console.log('🧹 Clearing existing data...');

    // Delete in reverse order of dependencies
    // await this.prisma.cartItem.deleteMany({});
    // await this.prisma.bookmark.deleteMany({});
    // await this.prisma.review.deleteMany({});
    // await this.prisma.orderItem.deleteMany({});
    // await this.prisma.order.deleteMany({});
    // await this.prisma.subscription.deleteMany({});
    // await this.prisma.subscriptionAccess.deleteMany({});
    // await this.prisma.subscriptionPlan.deleteMany({});
    // await this.prisma.aIConversation.deleteMany({});
    // await this.prisma.passwordResetOTP.deleteMany({});
    // await this.prisma.podcast.deleteMany({});
    // await this.prisma.programme.deleteMany({});
    // await this.prisma.storeItem.deleteMany({});
    // await this.prisma.product.deleteMany({});
    // await this.prisma.blogs.deleteMany({});
    // await this.prisma.user.deleteMany({});

    console.log('✅ Database cleared successfully');
  }

  private async seedAdmin() {
    console.log('👤 Seeding admin user...');

    const admin = await this.prisma.user.upsert({
      where: { email: adminSeedData.email },
      update: {},
      create: adminSeedData,
    });

    console.log(`✅ Admin user created: ${admin.email}`);
  }

  private async seedSubscriptionPlans() {
    console.log('💳 Seeding subscription plans...');

    for (const planData of subscriptionPlansSeedData) {
      const { subscriptionAccess, ...planInfo } = planData;

      const plan = await this.prisma.subscriptionPlan.create({
        data: {
          ...planInfo,
          subscriptionAccess: {
            create: subscriptionAccess,
          },
        },
        include: {
          subscriptionAccess: true,
        },
      });

      console.log(`✅ Subscription plan created: ${plan.name}`);
    }
  }

  private async seedStoreItems() {
    console.log('🛍️ Seeding store items...');

    for (const itemData of storeItemsSeedData) {
      const { product: productData, storeItem: storeItemData } = itemData;

      const product = await this.prisma.product.create({
        data: {
          ...productData,
          storeItem: {
            create: storeItemData,
          },
        },
        include: {
          storeItem: true,
        },
      });

      console.log(`✅ Store item created: ${product.storeItem?.name}`);
    }
  }

  private async seedProgrammes() {
    console.log('🎓 Seeding programmes...');

    for (const programmeData of programmesSeedData) {
      const { product: productData, programme: programmeInfo } = programmeData;

      const product = await this.prisma.product.create({
        data: {
          ...productData,
          programme: {
            create: programmeInfo,
          },
        },
        include: {
          programme: true,
        },
      });

      console.log(`✅ Programme created: ${product.programme?.title}`);
    }
  }

  private async seedPodcasts() {
    console.log('🎧 Seeding podcasts...');

    for (const podcastData of podcastsSeedData) {
      const { product: productData, podcast: podcastInfo } = podcastData;

      const product = await this.prisma.product.create({
        data: {
          ...productData,
          podcast: {
            create: podcastInfo,
          },
        },
        include: {
          podcast: true,
        },
      });

      console.log(`✅ Podcast created: ${product.podcast?.title}`);
    }
  }

  private async seedBlogs() {
    console.log('📝 Seeding blogs...');

    for (const blogData of blogsSeedData) {
      const blog = await this.prisma.blogs.create({
        data: blogData,
      });

      console.log(`✅ Blog created: ${blog.title}`);
    }
  }
}
