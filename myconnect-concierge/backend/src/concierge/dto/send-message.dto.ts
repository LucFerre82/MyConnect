import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class SendMessageDto {
    @IsUUID()
    @IsNotEmpty()
    attendeeId: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
