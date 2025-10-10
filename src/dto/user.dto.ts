import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsOptional()
  @IsString()
  assignedDeviceId?: string;

  @IsOptional()
  @IsString()
  allocatedLocationId?: string;

  @IsEnum(['employee', 'admin'])
  role: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  assignedDeviceId?: string;

  @IsOptional()
  @IsString()
  allocatedLocationId?: string;

  @IsOptional()
  @IsEnum(['employee', 'admin'])
  role?: string;
}