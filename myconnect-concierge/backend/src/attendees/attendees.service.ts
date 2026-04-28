import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SanitizerService } from '../sanitizer/sanitizer.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import OpenAI from 'openai';

@Injectable()
export class AttendeesService {
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private sanitizer: SanitizerService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    });
  }

  async create(eventId: string, dto: CreateAttendeeDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Sanitize user profile before storing
    const sanitized = await this.sanitizer.sanitizeAttendeeProfile(dto);
    if (!sanitized.safe) {
      throw new BadRequestException(
        `Profile contains unsafe content in fields: ${sanitized.blockedFields.join(', ')}`
      );
    }

    // Cast to required types since sanitization preserves all fields
    const cleanProfile = sanitized.sanitized as CreateAttendeeDto;

    const attendee = await this.prisma.attendee.create({
      data: { ...cleanProfile, eventId },
    });

    // Generate embedding asynchronously (don't block response)
    this.embedAttendee(attendee.id, cleanProfile).catch((err) => {
      console.error('Failed to embed attendee:', err);
    });

    return attendee;
  }

    async findByEvent(eventId: string, filters?: { role?: string; skills?: string }) {
    const where: any = { eventId };
    
    // Use case-insensitive partial match for role
    if (filters?.role) {
      where.role = { contains: filters.role, mode: 'insensitive' };
    }
    
    // Use hasSome with split skills
    if (filters?.skills) {
      const skillsArray = filters.skills
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (skillsArray.length > 0) {
        where.skills = { hasSome: skillsArray };
      }
    }

    return this.prisma.attendee.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
  }
  async findOne(eventId: string, attendeeId: string) {
    return this.prisma.attendee.findFirst({ where: { id: attendeeId, eventId } });
  }

  private async embedAttendee(attendeeId: string, dto: CreateAttendeeDto) {
    const profileText = `${dto.headline} ${dto.bio} ${dto.skills.join(' ')} ${dto.lookingFor}`;

    try {
      const response = await this.openai.embeddings.create({
        model: 'openai/text-embedding-3-small',
        input: profileText.substring(0, 8000),
      });

      const vector = `[${response.data[0].embedding.join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "Attendee" SET embedding = $1::vector WHERE id = $2`,
        [vector, attendeeId]
      );
      console.log(`Embedded attendee ${attendeeId}`);
    } catch (err) {
      console.error('Embedding failed:', err);
    }
  }
}