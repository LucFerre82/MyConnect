import { IsString, IsNotEmpty } from 'class-validator';

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    dates: string;

    @IsString()
    @IsNotEmpty()
    location: string;
}
