import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { PodcastService, PodcastEpisodeDto } from './podcast.service';
import { ControllerCacheInterceptor } from '../../util/cache/cache.interceptor';
import { ConfigService } from '../../config/config.service';
import { DEFAULT_CACHE_TTL_SECONDS } from '../../util/cache/cache.constants';
import { ENV } from '../../config/env.enum';

@UseInterceptors(ControllerCacheInterceptor)
@Controller('podcasts')
export class PodcastController {
  constructor(
    private readonly podcastService: PodcastService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
  ): Promise<{ episodes: PodcastEpisodeDto[] }> {
    const rssUrl = this.config.get(ENV.PODBEAN_RSS_URL);
    const all = await this.podcastService.fetchEpisodes(rssUrl);
    const lim = limit ? Math.max(parseInt(limit, 10) || 0, 0) : 0;
    const episodes = lim > 0 ? all.slice(0, lim) : all;
    return { episodes };
  }
}
