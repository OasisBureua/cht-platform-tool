import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitContactDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  message?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  organization?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  role?: string;
}
