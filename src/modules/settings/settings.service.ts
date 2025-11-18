import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from 'src/database/database.service';
import { settings } from 'src/database/schema';
import { DiscountType, Setting } from 'src/database/types';
import { GlobalDiscountConfig } from 'src/lib/helpers/discount.helper';
import { UpdateGlobalDiscountDto } from './dto/update-global-discount.dto';

export type GlobalDiscountSetting = GlobalDiscountConfig;

const GLOBAL_DISCOUNT_KEY = 'STORE_GLOBAL_DISCOUNT';
const DEFAULT_GLOBAL_DISCOUNT: GlobalDiscountSetting = {
  isActive: false,
  type: 'NONE',
  value: 0,
  minOrderTotal: 0,
  label: 'Network wide discount',
};

@Injectable()
export class SettingsService {
  constructor(private readonly database: DatabaseService) {}

  async getSettingRecord(key: string): Promise<Setting | null> {
    const record = await this.database.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return record[0] || null;
  }

  private parseSettingValue<T>(record: Setting | null, fallback: T): T {
    if (!record) {
      return fallback;
    }
    try {
      return JSON.parse(record.value) as T;
    } catch (error) {
      console.warn(
        `Failed to parse setting value for ${record.key}. Returning fallback.`,
        error,
      );
      return fallback;
    }
  }

  async upsertSetting<T>(
    key: string,
    value: T,
    metadata?: Partial<
      Pick<Setting, 'description' | 'category' | 'isEditable'>
    >,
  ): Promise<Setting> {
    const stringifiedValue = JSON.stringify(value);
    const now = new Date();

    const result = await this.database.db
      .insert(settings)
      .values({
        key,
        value: stringifiedValue,
        description: metadata?.description,
        category: metadata?.category,
        isEditable: metadata?.isEditable ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: stringifiedValue,
          description: metadata?.description,
          category: metadata?.category,
          isEditable: metadata?.isEditable ?? true,
          updatedAt: now,
        },
      })
      .returning();

    return result[0];
  }

  async getGlobalDiscount(): Promise<GlobalDiscountSetting> {
    const record = await this.getSettingRecord(GLOBAL_DISCOUNT_KEY);
    return this.parseSettingValue(record, DEFAULT_GLOBAL_DISCOUNT);
  }

  async updateGlobalDiscount(
    payload: UpdateGlobalDiscountDto,
  ): Promise<GlobalDiscountSetting> {
    const existing = await this.getGlobalDiscount();
    const sanitizedValue = Math.max(0, payload.value);
    const normalizedValue =
      payload.type === 'PERCENTAGE'
        ? Math.min(sanitizedValue, 100)
        : sanitizedValue;

    const isNone = payload.type === 'NONE';
    const nextValue: GlobalDiscountSetting = {
      isActive: isNone ? false : payload.isActive,
      type: payload.type,
      value: isNone ? 0 : normalizedValue,
      minOrderTotal: payload.minOrderTotal ?? existing.minOrderTotal ?? 0,
      label: payload.label || existing.label || DEFAULT_GLOBAL_DISCOUNT.label,
    };

    await this.upsertSetting(GLOBAL_DISCOUNT_KEY, nextValue, {
      description:
        'Global discount applied to qualifying marketplace checkout totals',
      category: 'commerce',
    });

    return nextValue;
  }
}
