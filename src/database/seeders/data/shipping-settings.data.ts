import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

export interface ShippingRatesConfig {
  services: Record<string, ShippingServiceConfig>;
  addOns?: Record<string, ShippingAddOn>;
  defaultService: string;
}

export interface ShippingServiceConfig {
  label: string;
  serviceCode: string;
  bands: WeightBand[];
  description?: string;
}

export interface WeightBand {
  maxWeight: number; // in grams
  price: number; // in GBP
}

export interface ShippingAddOn {
  label: string;
  price: number;
  description?: string;
}

export const createShippingSettingsData = (): ShippingRatesConfig => {
  return {
    services: {
      ROYAL_MAIL_2ND_CLASS: {
        label: 'Royal Mail 2nd Class',
        serviceCode: 'OLP2',
        bands: [
          { maxWeight: 1000, price: 4.19 },
          { maxWeight: 2000, price: 6.49 },
          { maxWeight: 5000, price: 9.99 },
          { maxWeight: 10000, price: 14.99 },
          { maxWeight: 20000, price: 24.99 },
          { maxWeight: 30000, price: 34.99 },
        ],
        description: 'Delivery within 2-3 working days',
      },
    },
    addOns: {
      SIGNED_FOR: {
        label: 'Signed For',
        price: 1.5,
        description: 'Signature required on delivery',
      },
    },
    defaultService: 'ROYAL_MAIL_2ND_CLASS',
  };
};
