export class MuxWebhookEventDto {
  data: {
    id: string;
    playback_ids: { id: string }[];
    passthrough: string;
    duration: number;
  };
  type: string;
}
