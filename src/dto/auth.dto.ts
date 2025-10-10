import { IsString, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsNumber()
  accuracy: number;

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