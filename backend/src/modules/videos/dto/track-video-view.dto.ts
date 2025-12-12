import { IsNumber, IsBoolean } from 'class-validator';

export class TrackVideoViewDto {
    @IsNumber()
    watchedSeconds: number;

    @IsBoolean()
    completed: boolean;
}