import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';
import { SanitizerModule } from '../sanitizer/sanitizer.module';

@Module({
  imports: [SanitizerModule, HttpModule],
  controllers: [ConciergeController],
  providers: [ConciergeService],
})
export class ConciergeModule {}