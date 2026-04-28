import { IsString, IsNotEmpty, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class CreateAttendeeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    headline: string;

    @IsString()
    @IsNotEmpty()
    bio: string;

    @IsString()
    @IsOptional()
    company?: string;

    @IsString()
    @IsOptional()
    role?: string;

    @IsArray()
    @IsString({ each: true })
    skills: string[];

    @IsString()
    @IsNotEmpty()
    lookingFor: string;

    @IsBoolean()
    @IsOptional()
    openToChat?: boolean;
}
