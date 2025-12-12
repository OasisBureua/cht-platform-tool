import { IsEmail, IsString, IsOptional, IsEnum } from 'class-validator';

export enum UserRole {
  HCP = 'HCP',
  ADMIN = 'ADMIN',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  authId: string;

  @IsString()
  @IsOptional()
  npiNumber?: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}