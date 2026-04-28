import { Global, Module } from '@nestjs/common';
import { SanitizerService } from './sanitizer.service';

@Global()
@Module({
  providers: [SanitizerService],
  exports: [SanitizerService],
})
export class SanitizerModule {}