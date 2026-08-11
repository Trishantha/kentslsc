import { Module } from '@nestjs/common';
import { CommitteeController } from './committee.controller.js';
import { CommitteeService } from './committee.service.js';

@Module({
  controllers: [CommitteeController],
  providers: [CommitteeService]
})
export class CommitteeModule {}
