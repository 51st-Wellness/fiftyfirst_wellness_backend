import { DiscountType } from 'src/database/types';

export interface DiscountRule {
  type: DiscountType;
  value: number;
}

export interface TimedDiscountRule extends DiscountRule {
  isActive?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface GlobalDiscountConfig extends DiscountRule {
  isActive: boolean;
  minOrderTotal?: number;
  label?: string;
}

const clampToTwoDecimals = (value: number): number =>
  Math.max(0, Math.round(value * 100) / 100);

export const isDiscountCurrentlyActive = (
  rule?: TimedDiscountRule | null,
  now: Date = new Date(),
): boolean => {
  if (!rule?.isActive) {
    return false;
  }

  if (rule.startsAt && now < rule.startsAt) {
    return false;
  }

  if (rule.endsAt && now > rule.endsAt) {
    return false;
  }

  return true;
};

export const applyDiscountValue = (
  amount: number,
  rule?: DiscountRule | null,
): { finalAmount: number; discountAmount: number } => {
  if (!rule) {
    return { finalAmount: clampToTwoDecimals(amount), discountAmount: 0 };
  }

  const normalizedValue = Math.max(0, rule.value || 0);
  let discountAmount = 0;

  switch (rule.type) {
    case 'PERCENTAGE': {
      const cappedPercentage = Math.min(normalizedValue, 100);
      discountAmount = (amount * cappedPercentage) / 100;
      break;
    }
    case 'FLAT': {
      discountAmount = Math.min(normalizedValue, amount);
      break;
    }
    default:
      discountAmount = 0;
  }

  const finalAmount = clampToTwoDecimals(amount - discountAmount);
  return {
    finalAmount,
    discountAmount: clampToTwoDecimals(discountAmount),
  };
};

export const shouldApplyGlobalDiscount = (
  config: GlobalDiscountConfig | null,
  orderSubtotal: number,
): config is GlobalDiscountConfig => {
  if (!config?.isActive) {
    return false;
  }

  if (config.minOrderTotal && orderSubtotal < config.minOrderTotal) {
    return false;
  }

  return true;
};
