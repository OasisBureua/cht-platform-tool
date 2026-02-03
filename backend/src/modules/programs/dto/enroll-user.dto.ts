import { IsString, IsNumber, IsBoolean } from 'class-validator';

export class EnrollUserDto {
  @IsString()
  userId: string;

  @IsString()
  programId: string;
}

export class EnrollmentResponseDto {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  programId: string;

  @IsNumber()
  overallProgress: number;

  @IsBoolean()
  completed: boolean;

  @IsString()
  enrolledAt: string;
}
