import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';

@Controller('events/:eventId/attendees')
export class AttendeesController {
    constructor(private readonly attendeesService: AttendeesService) {}

    @Post()
    create(@Param('eventId') eventId: string, @Body() dto: CreateAttendeeDto) {
        return this.attendeesService.create(eventId, dto);
    }

    @Get()
    findAll(
        @Param('eventId') eventId: string,
            @Query('role') role?: string,
            @Query('skills') skills?: string,
    ) {
        return this.attendeesService.findByEvent(eventId, { role, skills });
    }
}
