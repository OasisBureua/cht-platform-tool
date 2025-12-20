import { IsInt, IsString, IsOptional, Min } from 'class-validator';

export class CreatePayoutDto {
    @IsString()
    userId: string;

    @IsString()
    @IsOptional()
    programId?: string;

    @IsInt()
    @Min(1)
    amount: number; // in cents

    @IsString()
    description: string;
}

export class PayoutResponseDto {
    paymentId: string;
    amount: number;
    status: string;
    transferId?: string;
}