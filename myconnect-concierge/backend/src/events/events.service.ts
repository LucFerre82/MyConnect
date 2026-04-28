import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
    constructor(private prisma: PrismaService) {}

    async create(dto: CreateEventDto) {
        return this.prisma.event.create({ data: dto });
    }

    async findAll() {
        return this.prisma.event.findMany({ include: { attendees: true } });
    }

    async findOne(id: string) {
        return this.prisma.event.findUnique({
            where: { id },
            include: { attendees: true },
        });
    }
}
