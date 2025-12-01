// Queue name constants for BullMQ
export const QUEUE_NAMES = {
  TRACKING: 'tracking-',
} as const;

// Queue configuration
export const QUEUE_CONFIG = {
  [QUEUE_NAMES.TRACKING]: {
    name: QUEUE_NAMES.TRACKING,
    defaultJobOptions: {
      removeOnComplete: {
        age: 24 * 3600, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 7 days
      },
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
    },
  },
} as const;
