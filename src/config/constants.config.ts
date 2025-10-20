export const JWT_EXPIRATION = 3600 * 24 * 7; // 7 days

export const JWT_COOKIE_NAME = 'Authorization';
export const JWT_SERVICE = 'JWT_SERVICE';

// Response status
export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
}
export const CUSTOM_HEADERS = {
  rootApiKey: 'root-api-key',
};
