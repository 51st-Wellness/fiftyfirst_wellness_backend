import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from './env.enum';

@Injectable()
export class MuxConfig {
  constructor(private configService: ConfigService) {}

  get muxTokenId(): string {
    return this.configService.getOrThrow<string>(ENV.MUX_TOKEN_ID);
  }

  get muxTokenSecret(): string {
    return this.configService.getOrThrow<string>(ENV.MUX_TOKEN_SECRET);
  }

  get muxWebhookSecret(): string {
    return this.configService.getOrThrow<string>(ENV.MUX_WEBHOOK_SECRET);
  }
}
