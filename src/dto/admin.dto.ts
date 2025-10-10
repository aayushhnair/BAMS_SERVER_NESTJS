import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class AssignDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  lon: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  radiusMeters: number;
}