import { Module } from '@nestjs/common';
import { CsrfService } from './csrf.service.js';

@Module({
  providers: [CsrfService],
  exports: [CsrfService]
})
export class CsrfModule {}
