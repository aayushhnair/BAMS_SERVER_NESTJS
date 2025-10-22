import { IsString, IsNotEmpty, IsNumber, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsNumber()
  accuracy: number;

  // Optional flag sent by client: if true, client requests location validation for this request
  // If false, client explicitly opts out of server-side location validation.
  // If omitted, server will fallback to user's `locationValidationRequired` setting.
  @IsOptional()
  location_Status?: boolean;

  @IsString()
  ts: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;
}

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;
}