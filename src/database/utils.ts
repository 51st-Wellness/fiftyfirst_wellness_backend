import { createId } from '@paralleldrive/cuid2';

// Generate a CUID for use as primary keys
export function generateId(): string {
  return createId();
}
