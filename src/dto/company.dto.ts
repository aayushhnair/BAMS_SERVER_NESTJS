import { IsString, IsNotEmpty, IsObject, IsOptional, IsNumber } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  settings?: {
    sessionTimeoutHours?: number;
    heartbeatMinutes?: number;
  };
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  settings?: {
    sessionTimeoutHours?: number;
    heartbeatMinutes?: number;
  };
}