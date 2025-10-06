import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export interface PodcastEpisodeDto {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  imageUrl?: string;
  duration?: number;
  publishedAt?: string;
}

@Injectable()
export class PodcastService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  async fetchEpisodes(podbeanRssUrl: string): Promise<PodcastEpisodeDto[]> {
    const { data } = await axios.get<string>(podbeanRssUrl, {
      responseType: 'text',
    });
    const json = this.parser.parse(data);
    const channel = json?.rss?.channel;
    const items = Array.isArray(channel?.item)
      ? channel.item
      : channel?.item
        ? [channel.item]
        : [];
    return items
      .map((item: any) => this.mapItem(item))
      .filter((e) => !!e.audioUrl);
  }

  private mapItem(item: any): PodcastEpisodeDto {
    const enclosure = item?.enclosure;
    const audioUrl = typeof enclosure === 'object' ? enclosure.url : undefined;
    const imageUrl =
      item?.['itunes:image']?.href ||
      item?.image?.url ||
      item?.['media:thumbnail']?.url;
    const guid =
      typeof item?.guid === 'object'
        ? item.guid?.['#text'] || item.guid?.text
        : item?.guid;
    const durationRaw = item?.['itunes:duration'] || item?.duration;
    const duration = this.parseDuration(durationRaw);
    return {
      id: guid || audioUrl || item?.link || item?.title,
      title: item?.title || '',
      description: item?.description || item?.summary || '',
      audioUrl,
      imageUrl,
      duration,
      publishedAt: item?.pubDate,
    };
  }

  private parseDuration(value: any): number | undefined {
    if (!value) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parts = value.split(':').map((p) => parseInt(p, 10));
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }
}
