import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class AddTrackingDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{10,20}$/i, {
    message: 'Tracking reference must be alphanumeric and 10-20 characters',
  })
  trackingReference: string;
}
