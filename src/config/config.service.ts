import { ConfigService as ConfigServiceBase } from '@nestjs/config';
import { ENV } from './env.enum';
import { config } from 'dotenv';
config();

class ConfigService {
  constructor(private readonly configService: ConfigServiceBase) {}
  get(key: ENV, defaultValue?: string): string {
    if (!this.configService) {
      return process.env[key] || defaultValue!;
    }
    return this.configService.get(key) || defaultValue!;
  }
  set(key: ENV, value: any): void {
    this.configService.set(key, value);
  }

  validateEnv() {
    const envs = Object.values(ENV);
    const missingVars = envs.filter((value) => !this.get(value));
    if (missingVars.length > 0) {
      throw new Error(
        `Missing environment variables: ${missingVars.join(', ')}`,
      );
    }
  }
}
const configService = new ConfigService(new ConfigServiceBase());
export { configService, ConfigService };
