import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { PackageFormat } from '../tracking/royal-mail/click-drop.types';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { createShippingSettingsData } from 'src/database/seeders/data/shipping-settings.data';

// Shipping service configuration types
export interface WeightBand {
  maxWeight: number; // in grams
  price: number; // in GBP
}

export interface ShippingServiceConfig {
  label: string;
  serviceCode: string; // Account-specific Royal Mail service code
  bands: WeightBand[];
  description?: string;
}

export interface ShippingAddOn {
  label: string;
  price: number;
  description?: string;
}

export interface ShippingRatesConfig {
  services: Record<string, ShippingServiceConfig>;
  addOns?: Record<string, ShippingAddOn>;
  defaultService: string; // Key to services (e.g., 'ROYAL_MAIL_48')
}

// Cart item for calculation
export interface CartItemForShipping {
  weight?: number; // in grams
  length?: number; // in mm
  width?: number; // in mm
  height?: number; // in mm
  quantity: number;
}

// Available service option for checkout
export interface AvailableShippingService {
  key: string;
  label: string;
  serviceCode: string;
  price: number;
  isDefault: boolean;
  description?: string;
}

// Shipping calculation result
export interface ShippingCalculation {
  weight: number; // total weight in grams
  packageFormat: PackageFormat;
  dimensions: { height: number; width: number; depth: number } | null;
  basePrice: number;
  addOns: { key: string; label: string; price: number }[];
  totalPrice: number;
  serviceKey: string;
  serviceLabel: string;
  serviceCode: string;
}

// Settings keys
const SHIPPING_RATES_KEY = 'SHIPPING_RATES';
const DEFAULT_SHIPPING_SERVICE_KEY = 'DEFAULT_SHIPPING_SERVICE';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
  ) {}

  // Get shipping rates configuration
  async getShippingRates(): Promise<ShippingRatesConfig> {
    try {
      const record =
        await this.settingsService.getSettingRecord(SHIPPING_RATES_KEY);
      if (record) {
        return JSON.parse(record.value);
      }
    } catch (error) {
      this.logger.warn(
        'Failed to load shipping rates from settings, using defaults',
      );
    }
    return createShippingSettingsData();
  }

  // Update shipping rates configuration (admin only)
  async updateShippingRates(config: ShippingRatesConfig): Promise<void> {
    await this.settingsService.upsertSetting(SHIPPING_RATES_KEY, config, {
      description: 'Shipping service rates and configuration',
      category: 'shipping',
      isEditable: true,
    });
    this.logger.log('Shipping rates configuration updated');
  }

  // Get default shipping service key
  async getDefaultShippingService(): Promise<string> {
    const rates = await this.getShippingRates();
    return rates.defaultService;
  }

  // Get available shipping services with prices for given weight
  async getAvailableServices(
    totalWeightGrams: number,
  ): Promise<AvailableShippingService[]> {
    const rates = await this.getShippingRates();
    const defaultServiceKey = rates.defaultService;

    const services: AvailableShippingService[] = [];

    for (const [key, service] of Object.entries(rates.services)) {
      const price = this.getPriceForWeight(service.bands, totalWeightGrams);
      if (price !== null) {
        services.push({
          key,
          label: service.label,
          serviceCode: service.serviceCode,
          price,
          isDefault: key === defaultServiceKey,
          description: service.description,
        });
      }
    }

    return services;
  }

  // Calculate shipping cost for cart items
  async calculateShippingCost(
    cartItems: CartItemForShipping[],
    serviceKey?: string,
    addOnKeys?: string[],
  ): Promise<ShippingCalculation> {
    const rates = await this.getShippingRates();

    // Use default service if not specified
    const selectedServiceKey = serviceKey || rates.defaultService;
    const selectedService = rates.services[selectedServiceKey];

    if (!selectedService) {
      throw new Error(`Shipping service not found: ${selectedServiceKey}`);
    }

    // Validate service code is configured (OLP2 is the default for Royal Mail 2nd Class)
    if (!selectedService.serviceCode) {
      throw new Error(
        `Service code for ${selectedService.label} is not configured. Please update shipping settings with your Click & Drop account-specific service codes.`,
      );
    }

    // Consolidate cart items
    const consolidation = this.consolidateCartItems(cartItems);

    // Get price for total weight
    const basePrice = this.getPriceForWeight(
      selectedService.bands,
      consolidation.totalWeight,
    );

    if (basePrice === null) {
      throw new Error(
        `No shipping rate available for weight: ${consolidation.totalWeight}g`,
      );
    }

    // Calculate add-ons
    const addOns: { key: string; label: string; price: number }[] = [];
    let addOnsTotal = 0;

    if (addOnKeys && addOnKeys.length > 0 && rates.addOns) {
      for (const addOnKey of addOnKeys) {
        const addOn = rates.addOns[addOnKey];
        if (addOn) {
          addOns.push({
            key: addOnKey,
            label: addOn.label,
            price: addOn.price,
          });
          addOnsTotal += addOn.price;
        }
      }
    }

    return {
      weight: consolidation.totalWeight,
      packageFormat: consolidation.packageFormat,
      dimensions: consolidation.dimensions,
      basePrice,
      addOns,
      totalPrice: basePrice + addOnsTotal,
      serviceKey: selectedServiceKey,
      serviceLabel: selectedService.label,
      serviceCode: selectedService.serviceCode,
    };
  }

  // Consolidate cart items - calculate total weight and determine package format
  consolidateCartItems(items: CartItemForShipping[]): {
    totalWeight: number;
    packageFormat: PackageFormat;
    dimensions: { height: number; width: number; depth: number } | null;
  } {
    let totalWeight = 0;
    let maxHeight = 0;
    let maxWidth = 0;
    let maxDepth = 0;
    let hasDimensions = false;

    for (const item of items) {
      const itemWeight = item.weight || 100; // Default 100g if not specified
      totalWeight += itemWeight * item.quantity;

      if (item.height && item.width && item.length) {
        hasDimensions = true;
        maxHeight = Math.max(maxHeight, item.height);
        maxWidth = Math.max(maxWidth, item.width);
        maxDepth = Math.max(maxDepth, item.length);
      }
    }

    // Determine package format based on weight
    const packageFormat = this.determinePackageFormat(totalWeight);

    const dimensions = hasDimensions
      ? { height: maxHeight, width: maxWidth, depth: maxDepth }
      : null;

    return {
      totalWeight,
      packageFormat,
      dimensions,
    };
  }

  // Determine package format based on weight
  determinePackageFormat(weightGrams: number): PackageFormat {
    if (weightGrams <= 100) {
      return 'letter';
    } else if (weightGrams <= 750) {
      return 'largeLetter';
    } else if (weightGrams <= 2000) {
      return 'smallParcel';
    } else if (weightGrams <= 10000) {
      return 'mediumParcel';
    } else if (weightGrams <= 30000) {
      return 'largeParcel';
    } else {
      throw new Error(`Weight exceeds maximum: ${weightGrams}g (max 30kg)`);
    }
  }

  // Get price for given weight from weight bands
  private getPriceForWeight(
    bands: WeightBand[],
    weightGrams: number,
  ): number | null {
    // Sort bands by maxWeight ascending
    const sortedBands = [...bands].sort((a, b) => a.maxWeight - b.maxWeight);

    for (const band of sortedBands) {
      if (weightGrams <= band.maxWeight) {
        return band.price;
      }
    }

    // Weight exceeds all bands
    return null;
  }
}
