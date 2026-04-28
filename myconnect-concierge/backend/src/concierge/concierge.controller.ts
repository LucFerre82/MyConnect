import { Controller, Post, Get, Body, Param, BadRequestException } from '@nestjs/common';
import { ConciergeService } from './concierge.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@Controller('events/:eventId/concierge')
export class ConciergeController {
  constructor(
    private readonly conciergeService: ConciergeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('messages')
  sendMessage(@Param('eventId') eventId: string, @Body() dto: SendMessageDto) {
    return this.conciergeService.processMessage(eventId, dto);
  }

  @Post('messages/:messageId/feedback')
  submitFeedback(
    @Param('eventId') eventId: string,
    @Param('messageId') messageId: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.conciergeService.rateMessage(eventId, messageId, dto);
  }

  /**
   * Simplified feedback endpoint that doesn't require a messageId.
   * It finds the most recent assistant message for the given attendee
   * and stores the rating there.
   */
  @Post('feedback')
  async submitSimpleFeedback(
    @Param('eventId') eventId: string,
    @Body() dto: { attendeeId: string; rating: number; notes?: string },
  ) {
    const msg = await this.prisma.conversationMessage.findFirst({
      where: {
        attendeeId: dto.attendeeId,
        eventId,
        role: 'assistant',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!msg) {
      throw new BadRequestException('No messages found for this attendee');
    }

    return this.conciergeService.rateMessage(eventId, msg.id, {
      rating: dto.rating,
      notes: dto.notes,
    });
  }
}