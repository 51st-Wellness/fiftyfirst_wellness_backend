import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ENV } from '../config/env.enum';
import { createDatabaseConnection, Database } from './connection';
import { sql } from 'drizzle-orm';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private _db: Database;

  constructor(private readonly configService: ConfigService) {
    // Initialize the database connection
    this._db = createDatabaseConnection(
      this.configService.get(ENV.DATABASE_URL),
      this.configService.get(ENV.TURSO_AUTH_TOKEN),
    );
  }

  async onModuleInit() {
    try {
      // Check if the database connection is alive
      await this._db.run(sql`select 1`);
      console.log('✅ Database connection is healthy');
    } catch (error) {
      console.error('❌ Failed to connect to Turso database:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      // Drizzle with libSQL doesn't need explicit disconnection
      // but we can log the shutdown
      console.log('🔌 Database connection closed successfully');
    } catch (error) {
      console.error('❌ Error during database disconnection:', error);
      // Don't throw here as the application is shutting down
    }
  }

  // Getter to access the database instance
  get db(): Database {
    return this._db;
  }
}
