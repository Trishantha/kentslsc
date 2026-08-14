import { Module } from '@nestjs/common';
import { PolicyDocumentsService } from './policy-documents.service.js';
import { PolicyDocumentsController } from './policy-documents.controller.js';

@Module({
  controllers: [PolicyDocumentsController],
  providers: [PolicyDocumentsService],
  exports: [PolicyDocumentsService]
})
export class PolicyDocumentsModule {}
