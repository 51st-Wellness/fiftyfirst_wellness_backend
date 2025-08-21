import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { ENV } from 'src/config/env.enum';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    console.log('config servce', configService);
    super({
      adapter: new PrismaLibSQL({
        url: configService.get(ENV.DATABASE_URL),
        authToken: configService.get(ENV.TURSO_AUTH_TOKEN),
      }),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connected to Turso database successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Turso database:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('🔌 Disconnected from Turso database successfully');
    } catch (error) {
      console.error('❌ Error during database disconnection:', error);
      // Don't throw here as the application is shutting down
    }
  }
}
