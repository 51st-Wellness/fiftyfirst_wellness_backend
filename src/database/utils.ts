import { createId } from '@paralleldrive/cuid2';

// Generate a CUID for generic primary keys
export function generateId(): string {
  return createId();
}

// Generate a 5-char uppercase order id
export function generateOrderId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  let id = '';
  for (let i = 0; i < 5; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    id += alphabet[idx];
  }
  return id;
}
