import { cloneDeep } from 'lodash';

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'pin',
  'pin_hash',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'session_token',
  'card_number',
  'cvv',
  'card_pin',
  'bank_account',
  'payment_token',
  'gateway_response',
];

const PARTIAL_MASK_FIELDS = ['email', 'phone', 'license_number', 'employeeId'];

export class SensitiveDataFilter {
  static filterObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const filtered = cloneDeep(obj);
    this.recursiveFilter(filtered);
    return filtered;
  }

  private static recursiveFilter(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item) => this.recursiveFilter(item));
      return;
    }

    Object.keys(obj).forEach((key) => {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (
        PARTIAL_MASK_FIELDS.some((field) => lowerKey.includes(field))
      ) {
        obj[key] = this.partialMask(obj[key]);
      } else if (typeof obj[key] === 'object') {
        this.recursiveFilter(obj[key]);
      }
    });
  }

  private static partialMask(value: string): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    if (value.includes('@')) {
      // Email masking
      const [user, domain] = value.split('@');
      return `${user.substring(0, 2)}***@${domain}`;
    }

    if (value.length > 6) {
      // Phone/ID masking
      return `${value.substring(0, 3)}***${value.substring(value.length - 2)}`;
    }

    return '***';
  }
}
