import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { AttendeesModule } from './attendees/attendees.module';
import { ConciergeModule } from './concierge/concierge.module';
import { SanitizerModule } from './sanitizer/sanitizer.module';

@Module({
  imports: [PrismaModule, EventsModule, AttendeesModule, ConciergeModule, SanitizerModule],
})
export class AppModule {}