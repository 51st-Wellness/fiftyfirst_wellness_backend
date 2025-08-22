type DefaultExcludeKeys = 'id' | 'createdAt' | 'updatedAt' | 'deletedAt';

export class DataFormatter {
  static formatObject<T, K extends keyof T = keyof T>(
    data: T,
    exclude: K[] = [],
    defaultsExclude: DefaultExcludeKeys[] = [
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  ): Omit<T, K> {
    const toExclude = [
      ...new Set([...defaultsExclude, ...exclude]),
    ] as (keyof T)[];
    // Delete other fields if specified
    toExclude.forEach((field) => {
      delete (data as any)[field];
    });
    // Recursively format nested objects and arrays
    for (let key in data) {
      if (Array.isArray((data as any)[key]) && (data as any)[key].length) {
        (data as any)[key] = (data as any)[key].map((item: any) => {
          if (typeof item === 'object') {
            return this.formatObject(item);
          }
          return item;
        });
      } else if (
        typeof (data as any)[key] === 'object' &&
        (data as any)[key] !== null &&
        Object.keys((data as any)[key]).length > 0
      ) {
        (data as any)[key] = this.formatObject((data as any)[key]);
      }
    }
    return data;
  }
}
