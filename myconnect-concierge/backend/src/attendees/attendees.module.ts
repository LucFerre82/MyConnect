import { Module } from '@nestjs/common';
import { AttendeesService } from './attendees.service';
import { AttendeesController } from './attendees.controller';
import { SanitizerModule } from '../sanitizer/sanitizer.module';

@Module({
  imports: [SanitizerModule],
  controllers: [AttendeesController],
  providers: [AttendeesService],
  exports: [AttendeesService],
})
export class AttendeesModule {}