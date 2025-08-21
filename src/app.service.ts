import { Injectable } from '@nestjs/common';
import { ENV } from 'src/config/env.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
